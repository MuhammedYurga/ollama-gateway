# Docker

The image runs the same single-file gateway, with one difference that needs a
decision: inside a container the server must listen on all interfaces to be
reachable through the published port. The published port therefore has to stay
on the host loopback.

## Build and run

```bash
docker build -t ollama-gateway .
docker run -d --name ollama-gateway \
  -p 127.0.0.1:8799:8799 \
  -v ollama-gateway-data:/data \
  ollama-gateway
```

Or with Compose:

```bash
docker compose up -d
```

The first start creates `/data/config.json`, generates a random panel password
and prints it once:

```bash
docker logs ollama-gateway | grep "generated admin password"
```

Open `http://127.0.0.1:8799/admin` and sign in with that password. The image
does not run as `--bind 0.0.0.0` unless a panel password exists, so a fresh
container can never start with an open panel.

## Data

Everything lives in `/data`: the configuration file, the usage log and the
captures. Mount it as a volume, otherwise a container restart loses the
configuration and the API key.

```bash
docker run -v ollama-gateway-data:/data ...
```

To use an existing configuration file from the host:

```bash
docker run -v "$PWD/config.json:/data/config.json:ro" ...
```

A read-only mount works for reading, but the panel cannot save. Mount the
directory instead when you want to edit from the panel.

## Reaching Ollama

**Cloud mode** needs nothing from the host. Enter the API key in the panel.

**Local mode** runs the gateway in a different network namespace, so
`127.0.0.1` points at the container itself. Point the panel's **Ollama host** at
the host machine instead:

- Docker Desktop (macOS, Windows): `host.docker.internal`
- Linux: add `--add-host=host.docker.internal:host-gateway` (the Compose file
  already does) and use `host.docker.internal`

Ollama must accept connections from outside its own loopback:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Then set `local.host` to `host.docker.internal` and keep port `11434`.

## Security model

| Surface | Exposure |
| --- | --- |
| Model API (`/v1/messages`) | Reachable from whatever the published port allows, and it has no authentication of its own |
| Admin panel (`/admin`) | Only answers requests whose `Host` header is a loopback name, so it stays local even when the port is published elsewhere |
| Configuration file | Plain text inside the volume; it holds the Ollama Cloud key |

Publish on `127.0.0.1` only:

```bash
-p 127.0.0.1:8799:8799     # correct
-p 8799:8799               # exposes the model API to your network
```

The gateway refuses a non-loopback bind without a panel password, but that does
not authenticate the model API. Treat the published port as a local-only
socket.

## Updating

```bash
docker compose build --pull
docker compose up -d
```

The volume survives a rebuild. Check the configuration after an upgrade:

```bash
docker compose exec ollama-gateway node anthropic-proxy.js --check-config
```

## Troubleshooting

- The container exits with "refusing to listen on 0.0.0.0 without a panel
  password": the mounted config has no password. Start once without the mount
  to generate one, or set `admin.token` in the file.
- `docker logs` shows no password: the config file already existed, so no new
  password was generated.
- Local mode returns 502: Ollama is not reachable from the container; check
  `OLLAMA_HOST` and the `host.docker.internal` mapping.
- The panel is unreachable from another machine: by design.
