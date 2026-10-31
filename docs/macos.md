# macOS

The gateway is plain Node.js and runs on macOS without native modules. This
guide covers a foreground run and a per-user launchd agent.

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

The default config location is
`~/Library/Application Support/ollama-gateway/config.json`. Logs and captures
are written next to it. Override with `--config`, `PROXY_CFG`, `--data-dir` or
`PROXY_DATA_DIR`.

The listener binds `127.0.0.1` only. Do not expose the port through a reverse
proxy, tunnel or firewall rule.

## launchd agent

launchd does not read your shell `PATH`, so use absolute paths.

```bash
which node
which ollama-gateway
```

Create `~/Library/LaunchAgents/com.ollama-gateway.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ollama-gateway</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/opt/homebrew/lib/node_modules/ollama-gateway/anthropic-proxy.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/ollama-gateway.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ollama-gateway.err</string>
</dict>
</plist>
```

Load it:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ollama-gateway.plist
launchctl print gui/$(id -u)/com.ollama-gateway | head -20
```

Reload after an upgrade:

```bash
launchctl bootout gui/$(id -u)/com.ollama-gateway
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ollama-gateway.plist
```

The panel password is printed to `/tmp/ollama-gateway.log` only when the config
file is created for the first time.

## Ollama

If Ollama runs as a menu bar app or a Homebrew service:

```bash
brew services list
curl -s http://127.0.0.1:11434/v1/models
```

Pull the model you plan to map:

```bash
ollama pull qwen3:8b
```

For cloud models through the local daemon, run `ollama signin`; cloud model
names use the `:cloud` suffix. For the direct Cloud API, no local install is
needed: create an API key and use the names returned by
`https://ollama.com/api/tags`.

## API key

Prefer entering the Ollama Cloud key in the admin panel; it is stored in the
config file with `0600` permissions. If you use `OLLAMA_API_KEY`, export it in
the plist instead, which keeps it out of your shell history:

```xml
<key>EnvironmentVariables</key>
<dict>
  <key>OLLAMA_API_KEY</key>
  <string>your-key</string>
</dict>
```

The key in the config file wins over the environment variable.

## Tests

```bash
npm test
npm run check
```

The CI workflow runs the same suite on `ubuntu-latest` and `windows-latest`
with Node 20, 22 and 24. macOS is not in the matrix; the code uses Node
built-ins only.

## Uninstall

```bash
launchctl bootout gui/$(id -u)/com.ollama-gateway
rm ~/Library/LaunchAgents/com.ollama-gateway.plist
npm uninstall -g ollama-gateway
```

Your configuration and logs under `~/Library/Application Support/ollama-gateway`
are not removed by the uninstall command.
