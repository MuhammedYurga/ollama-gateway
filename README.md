# ollama-gateway

[![npm version](https://img.shields.io/npm/v/ollama-gateway.svg)](https://www.npmjs.com/package/ollama-gateway)
[![CI](https://github.com/MuhammedYurga/ollama-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/MuhammedYurga/ollama-gateway/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE)

A small local gateway that lets clients speaking the Anthropic Messages API use
Ollama models, whether they run on your machine or on Ollama Cloud. It accepts
`POST /v1/messages` (including streaming), answers
`POST /v1/messages/count_tokens` with a local estimate, and forwards
`GET /v1/models` to the configured upstream.

> **Unofficial. Not affiliated with, endorsed by, sponsored by, or supported by
> Anthropic PBC or Ollama.** This project provides no model access and no API
> keys. It does not use Claude models. Anthropic does not support routing
> Claude Code to non-Claude models through any gateway. You are responsible for
> complying with the terms of the clients and providers you use. Read
> [LEGAL.md](LEGAL.md) before deploying it.

## Why this exists

Anthropic-compatible clients are becoming a common interface, while capable
models increasingly run on your own machine or on a provider you choose. Moving
between them should not require a different client, a hosted relay, or an
account you do not want.

This gateway is the thinnest adapter between those worlds: it rewrites the model
name, keeps the Messages API wire format intact (streaming included), and
forwards the request to the upstream you configured. It does not host models,
resell access, or add a telemetry layer.

## What it is

- A single Node.js server file plus the admin panel assets; no runtime
  dependencies (Node 20+).
- Two upstream paths, switchable at runtime from the admin panel:
  - **local**: the Ollama daemon at `127.0.0.1:11434`; it can serve local
    models and, after `ollama signin`, cloud models
  - **cloud**: `https://ollama.com` with your own API key; no local install
- Per-mode model maps: the model name your client sends (for example
  `claude-opus-5`) is translated to an Ollama model you choose.
- A browser admin panel at `http://127.0.0.1:8799/admin` for connection mode,
  model maps, logging, filters and status. English first, with a Turkish
  translation and browser language detection.
- Model discovery: the panel lists what the upstream actually serves, validates
  your map against it and can send one test message end to end.
- Configuration export and import (without secrets) and a safe reset.
- Streams are passed through byte-for-byte; the gateway does not rewrite the
  response body.

## What it is not

- It is not a Claude proxy, a subscription bridge, or a way to obtain model
  access. It never calls Anthropic inference services and never uses Anthropic
  credentials.
- It is not a multi-user server. It binds to `127.0.0.1` only.
- It is not a complete Anthropic API implementation. Only the endpoints listed
  above are handled; everything else returns 404.

## Requirements

- Node.js 20 or newer.
- An Ollama upstream:
  - a local Ollama daemon with `/v1/messages` support, optionally signed in for
    cloud models, or
  - an Ollama Cloud account and API key for direct cloud mode.
- A client that lets you set an Anthropic-compatible base URL.

## Platforms

Windows, macOS and Linux with Node.js 20 or newer. The CI matrix runs Ubuntu and
Windows. Windows launchers are included.

Per-platform setup: [docs/linux.md](docs/linux.md) (systemd user service),
[docs/macos.md](docs/macos.md) (launchd agent),
[docs/windows.md](docs/windows.md) (start at sign-in, service).

## Install

```bash
npx ollama-gateway
```

or

```bash
npm install -g ollama-gateway
ollama-gateway
```

From a checkout of this repository:

```bash
git clone https://github.com/MuhammedYurga/ollama-gateway.git
cd ollama-gateway
node anthropic-proxy.js
```

On first start with no configuration file, the gateway creates one, generates a
random admin password, and prints it once:

```
[config] panel sifresi olusturuldu: <random>
proxy: http://127.0.0.1:8799
panel: http://127.0.0.1:8799/admin  (sifreli)
```

## Quick start

The gateway can reach Ollama in two ways. The panel labels describe the
connection path, not where the model runs: **Yerel Ollama** means "through the
local Ollama daemon", and that daemon can serve local models and, when signed
in, cloud models too.

| Path | Gateway mode | Local models | Cloud models | Requirements |
| --- | --- | --- | --- | --- |
| Local Ollama daemon | **Yerel Ollama**, `127.0.0.1:11434` | Yes, after `ollama pull` | Yes, after `ollama signin`, with `:cloud` names | Ollama installed |
| Direct Ollama Cloud API | **Ollama Cloud**, `https://ollama.com` | No | Yes | Ollama account and API key; no local install |

Model names and capabilities are listed at
[ollama.com/search](https://ollama.com/search). The app and CLI use the
`:cloud` suffix for cloud models, for example
`deepseek-v4.1-flash:cloud`. The direct Cloud API uses the name returned by
`GET https://ollama.com/api/tags`, for example `deepseek-v4.1-flash`. The API
key is sent as `Authorization: Bearer`; the gateway does this for you and never
forwards the client's `x-api-key`.

Cloud availability and limits depend on your Ollama plan; local models depend
on your hardware. The admin panel is English by default and follows the browser
language, with an EN/TR switch; the HTTP API and the configuration file are
language-neutral.

### Option A: Local Ollama daemon (local and cloud models)

1. Install and start Ollama.
2. For a local model, pull it:

   ```bash
   ollama pull qwen3:8b
   ```

3. For cloud models through the same daemon, sign in to ollama.com:

   ```bash
   ollama signin
   ```

   Cloud models then use the `:cloud` suffix, for example
   `deepseek-v4.1-flash:cloud`.

4. Start the gateway.
5. Open `http://127.0.0.1:8799/admin` and enter the generated password.
6. In **Ayarlar > Bağlantı yöntemi**, choose **Yerel Ollama**, keep
   `127.0.0.1:11434`, and save. The local API needs no API key.
7. In **Modeller**, map the model name your client sends to a model the daemon
   can serve:
   - local: `claude-opus-5 -> qwen3:8b`
   - cloud: `claude-opus-5 -> deepseek-v4.1-flash:cloud`

   Set the fallback model as well.
8. Point your client at the gateway.

### Option B: Direct Ollama Cloud API (API key)

1. Create an Ollama account and API key at [ollama.com](https://ollama.com). No
   local Ollama install or daemon is required. API keys do not expire; revoke
   them from the Ollama settings page when necessary.
2. Pick a cloud model from [ollama.com/search](https://ollama.com/search) and
   confirm its API name:

   ```bash
   curl https://ollama.com/api/tags \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

   The direct API uses that name, for example `deepseek-v4.1-flash`. The
   `:cloud` suffix is the local app/CLI shorthand.
3. Start the gateway.
4. Open `http://127.0.0.1:8799/admin` and enter the generated password.
5. In **Ayarlar > Bağlantı yöntemi**, choose **Ollama Cloud**, paste the API key,
   keep `https://ollama.com`, and save.
6. In **Modeller**, switch to **Bulut** and map the model name your client sends
   to the API model, for example `claude-opus-5 -> deepseek-v4.1-flash`. Set the
   fallback model as well.
7. Point your client at the gateway.

### Claude Code

Claude Code accepts a custom base URL. On Windows:

```bat
set ANTHROPIC_BASE_URL=http://127.0.0.1:8799
set ANTHROPIC_AUTH_TOKEN=ollama
claude --model claude-opus-5
```

macOS and Linux:

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8799
export ANTHROPIC_AUTH_TOKEN=ollama
claude --model claude-opus-5
```

The gateway ignores the client token. Clients usually require one to be set.
Anthropic's documentation states that non-Claude routing through gateways is
unsupported; use at your own risk.

### Other clients

Any client that can target an Anthropic-compatible base URL should work. Some
desktop builds expose a gateway or custom-provider setting; availability and
support vary by version and plan. Check the client's documentation and terms
before changing it.

Concrete recipes for Claude Code, Continue, Cline and a plain `curl` check are
in [docs/clients.md](docs/clients.md).

## Admin panel

The panel is the normal way to configure the gateway. It has six tabs:

| Tab | What it is for |
| --- | --- |
| Overview | Setup checklist, live counters, a copy-ready client snippet, recent requests |
| Models | Per-mode model maps, upstream model discovery, map validation |
| Filters | Local request filters that answer without calling the upstream |
| Style addon | Instructions appended to every system prompt |
| Logs | usage-log tail and capture files |
| Settings | Connection, port, panel password, request fixes, logging, config file |

The overview tab runs three checks: whether the upstream answers, whether a
model is mapped, and whether a test message comes back. **Discover models**
reads `/api/tags` from the active upstream and marks any map target it does not
know, so a typo surfaces before a client hits it.

**Export config** writes JSON without the API key or the panel password.
**Import config** accepts that file and keeps the stored secrets when the file
does not carry them. **Reset to defaults** restores the neutral defaults and
either keeps or rotates the panel password, so the panel is never left open.

The panel is keyboard navigable (arrow keys move between tabs) and usable on a
phone-sized screen.

## Configuration

The configuration file is resolved in this order:

1. `--config <path>`
2. `PROXY_CFG` environment variable
3. `proxy-config.json` next to `anthropic-proxy.js` (checkout mode)
4. User config directory:
   - Windows: `%APPDATA%\ollama-gateway\config.json`
   - macOS: `~/Library/Application Support/ollama-gateway/config.json`
   - Linux: `$XDG_CONFIG_HOME/ollama-gateway/config.json`
     (or `~/.config/...`)

Logs and captures are written next to the configuration file unless
`--data-dir` or `PROXY_DATA_DIR` says otherwise.

See [proxy-config.example.json](proxy-config.example.json) for a complete
example. The important fields:

| Field | Meaning |
| --- | --- |
| `mode` | `local` or `cloud` |
| `port` | Gateway port, default `8799` |
| `local.host`, `local.port` | Local Ollama daemon; can serve `:cloud` models after `ollama signin` |
| `local.modelMap`, `local.fallbackModel` | Model translation for the local daemon path (local or `:cloud` names) |
| `cloud.baseUrl` | Direct Ollama Cloud API base URL, default `https://ollama.com` |
| `cloud.apiKey` | API key for direct cloud mode, sent as Bearer. Not used by the local daemon path |
| `cloud.modelMap`, `cloud.fallbackModel` | Model translation for direct cloud mode; use names from `/api/tags` |
| `systemAddon` | Extra instructions appended to every `system` prompt (empty by default) |
| `blockRules` | Local request filters, disabled by default |
| `titleFix` | Compatibility fix for small title-generation requests |
| `countTokens` | Local token estimate for `count_tokens` |
| `logging` | Usage log, prompt heads, body capture, rotation |
| `admin.token` | Panel password; empty means no password |

Precedence for mode and port: command line, then environment, then file. The
Ollama key in the file wins over `OLLAMA_API_KEY`; the environment variable is
used only when the file field is empty.

The panel never receives the API key or the panel password back; it only learns
whether they are set. Saving a blank secret field keeps the existing value.

## CLI

```
ollama-gateway [options]

  --config <path>    Configuration file
  --data-dir <path>  Directory for logs and captures
  --port <number>    Gateway port (default 8799)
  --mode <mode>      local | cloud
  -h, --help         Show help
  -v, --version      Show version
```

Environment variables: `PROXY_CFG`, `PROXY_DATA_DIR`, `PROXY_PORT`,
`PROXY_MODE`, `OLLAMA_API_KEY`.

## Logging and privacy

By default:

- `usage-log.txt` records request metadata: time, token counts, duration,
  status, mode, requested model, bucket and user agent. It does not record
  prompt text.
- Full request/response capture is **off**. If you enable `logging.fullCapturePerBucket`,
  complete prompts, system text and responses are written to `captures/` in
  plain text. Do not enable it on data you are not allowed to store.
- Prompt heads in the usage log are **off**. Enabling `logging.promptHeads`
  writes the first 300 characters of the system prompt and the first user
  message.
- The diagnostic probe log is **off**.
- Logs rotate at 50 MB to `usage-log.1.txt`.

The panel can clear logs and captures, but not selectively delete individual
files. They are ordinary files in the data directory; delete them with your file
manager when you no longer need them.

## Security

- Binds to `127.0.0.1` only. Do not expose the port through a reverse proxy,
  tunnel, or port forward.
- Admin requests are checked against the listening port using `Host` and
  `Origin`; configuration writes require `Content-Type: application/json`.
  This blocks cross-site request forgery and DNS rebinding from a browser.
- The admin token is accepted only in the `x-admin-token` header, never in a
  query string.
- The panel keeps the password in `sessionStorage`, so closing the tab signs you
  out. Use the "oturumu kapat" button to clear it immediately.
- Client `Authorization` and `x-api-key` headers are never forwarded upstream.
  Cloud mode replaces them with the configured Ollama key.
- The configuration file is written with mode `0600` where the platform supports
  it. On Windows the key is plain text in `%APPDATA%`; protect the account.
- Request bodies are limited to 32 MB; admin configuration bodies to 2 MB.

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Development

```bash
npm test          # node:test suite, includes a fake-upstream integration test
npm run check     # syntax check
npm pack --dry-run
```

The project intentionally keeps the server in one file. Tests import the pure
configuration helpers and start the real server with an ephemeral port.

## Compatibility and limitations

- The gateway forwards the request body to the upstream after model mapping and
  optional system-prompt changes. Tool use, images and other fields are passed
  through; whether they work depends on the upstream.
- `count_tokens` is an estimate (`characters / 3.3` by default), not a real
  tokenizer.
- `titleFix` deletes a `thinking` field and raises a small `max_tokens` for
  requests whose system prompt contains `short session titles`. It is a
  compatibility workaround for clients that generate session titles.
- One process serves one upstream at a time. Switching modes affects new
  requests; in-flight requests keep the mode they started with.
- Changing the port requires a restart.

## Project direction

The short-term focus is a global, English-first experience; the longer term is a
provider-neutral gateway for local and cloud model runtimes. See
[ROADMAP.md](ROADMAP.md) for phases, non-goals and long-term directions,
[docs/architecture.md](docs/architecture.md) for the request flow, and
[CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
and the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues should follow
[SECURITY.md](SECURITY.md), not a public issue.

## Legal

See [LEGAL.md](LEGAL.md). In short: no affiliation, no hosted access, your own
credentials only, no resale or sharing, no bypassing provider limits or
guardrails, and no warranty. The Apache-2.0 license grants no trademark rights.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

You may use and modify the software commercially. The license requires you to
keep copyright and attribution notices, include the NOTICE file in derivative
distributions, and mark modified files. Attribution therefore cannot be
removed. The license does not require attribution in a user interface; we ask
for it, but it is not a condition.
