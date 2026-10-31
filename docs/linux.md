# Linux

The gateway is plain Node.js and runs on Linux without native modules. This
guide covers a foreground run and a per-user systemd service.

## Requirements

- Node.js 20 or newer.
- Ollama on `127.0.0.1:11434`, or an Ollama Cloud API key.
- A client that can target an Anthropic-compatible base URL.

## Install and run

```bash
npx ollama-gateway
```

or, globally:

```bash
npm install -g ollama-gateway
ollama-gateway
```

From a checkout:

```bash
node anthropic-proxy.js
```

The default config location is `$XDG_CONFIG_HOME/ollama-gateway/config.json`,
falling back to `~/.config/ollama-gateway/config.json`. Logs and captures are
written next to it. Override with `--config`, `PROXY_CFG`, `--data-dir` or
`PROXY_DATA_DIR`.

The listener binds `127.0.0.1` only. Do not expose the port through a reverse
proxy, tunnel or firewall rule.

## systemd user service

Create the unit:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/ollama-gateway.service <<'EOF'
[Unit]
Description=ollama-gateway
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env ollama-gateway
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
EOF
```

If the global npm bin directory is not on the user service `PATH`, use the
absolute path instead:

```ini
ExecStart=/home/YOUR_USER/.npm-global/bin/ollama-gateway
```

Then:

```bash
systemctl --user daemon-reload
systemctl --user enable --now ollama-gateway
systemctl --user status ollama-gateway
journalctl --user -u ollama-gateway -f
```

## Ollama

If Ollama runs as a system service:

```bash
systemctl status ollama
curl -s http://127.0.0.1:11434/v1/models
```

Pull the model you plan to map:

```bash
ollama pull qwen3:8b
```

For cloud models through the local daemon, run `ollama signin`; cloud model
names use the `:cloud` suffix. For the direct Cloud API, no local install is
needed: create an API key and use the names returned by
`https://ollama.com/api/tags` (for example `deepseek-v4.1-flash`).

## API key

Prefer entering the Ollama Cloud key in the admin panel, which stores it in the
config file with `0600` permissions. If you use `OLLAMA_API_KEY`, keep it in an
environment file with restrictive permissions and reference it from the unit:

```ini
EnvironmentFile=%h/.config/ollama-gateway/env
```

```bash
chmod 600 ~/.config/ollama-gateway/env
```

The key in the config file wins over the environment variable; the environment
variable is used only when the file field is empty.

## Tests

```bash
npm test
npm run check
```

The CI workflow runs the same suite on `ubuntu-latest` with Node 20, 22 and 24.

## Troubleshooting

- `EADDRINUSE`: another process owns the port. Stop it or start with `--port`.
- `401` in cloud mode: the API key is missing or rejected.
- Model not found: check the active mode's model map and fallback in the panel.
- Panel unreachable: the gateway binds loopback; use `127.0.0.1`, not a LAN IP.

## Uninstall

```bash
systemctl --user disable --now ollama-gateway
rm ~/.config/systemd/user/ollama-gateway.service
npm uninstall -g ollama-gateway
```

Your configuration and logs under `~/.config/ollama-gateway` are not removed by
the uninstall command. Delete them separately if you no longer need them.
