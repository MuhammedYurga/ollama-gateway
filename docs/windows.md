# Windows

The gateway runs on Windows 10 and 11 with Node.js 20 or newer. The CI matrix
includes `windows-latest`, so the test suite runs on Windows on every push.

## Requirements

- Node.js 20 or newer.
- Ollama for Windows on `127.0.0.1:11434`, or an Ollama Cloud API key.
- A client that can target an Anthropic-compatible base URL.

## Install and run

```bat
npx ollama-gateway
```

or, globally:

```bat
npm install -g ollama-gateway
ollama-gateway
```

From a checkout, `PROXY.bat` starts `node anthropic-proxy.js` without a console
window when paired with `start-proxy.vbs`.

The default config location is `%APPDATA%\ollama-gateway\config.json`. Logs and
captures are written next to it. Override with `--config`, `PROXY_CFG`,
`--data-dir` or `PROXY_DATA_DIR`.

The listener binds `127.0.0.1` only. Windows Firewall needs no rule, and the
port must not be forwarded or exposed through a tunnel.

## Start at sign-in

The simplest option is a shortcut in the Startup folder:

1. Press `Win+R`, type `shell:startup`, press Enter.
2. Right-click the folder, choose **New > Shortcut**.
3. Target: `wscript.exe "C:\path\to\start-proxy.vbs"`.

For a delayed or hidden start, use Task Scheduler:

1. **Create Task** (not *Basic Task*).
2. Trigger: **At log on**, your account.
3. Action: **Start a program**, program `node`, arguments
   `"C:\path\to\anthropic-proxy.js"`, start in `C:\path\to`.
4. General: **Run only when user is logged on**. The gateway is a user tool and
   does not need SYSTEM.

The task runs in the background; the panel is still reachable at
`http://127.0.0.1:8799/admin`.

## Windows service

Node.js is not a service host. If the gateway must run before sign-in, wrap it
with a service manager such as [NSSM](https://nssm.cc/):

```bat
nssm install ollama-gateway "C:\Program Files\nodejs\node.exe" "C:\path\to\anthropic-proxy.js"
nssm set ollama-gateway AppDirectory "C:\path\to"
nssm set ollama-gateway AppStdout "C:\path\to\gateway.log"
nssm set ollama-gateway AppStderr "C:\path\to\gateway.err"
nssm start ollama-gateway
```

A service runs as `LocalSystem` by default and therefore reads
`C:\Windows\System32\config\systemprofile\AppData\Roaming`. Point it at a real
config with `--config` instead:

```bat
nssm set ollama-gateway AppParameters "--config C:\gateway\config.json --data-dir C:\gateway"
```

The config file stores the API key in plain text. Restrict the folder to the
account that needs it.

## PowerShell note

If `npm` fails with "running scripts is disabled on this system", the
`npm.ps1` shim is blocked by the execution policy. Use `npm.cmd`:

```bat
npm.cmd install -g ollama-gateway
```

Changing the execution policy is not required for the gateway itself.

## Ollama

```bat
ollama list
curl http://127.0.0.1:11434/v1/models
```

For cloud models through the local daemon, run `ollama signin`; cloud model
names use the `:cloud` suffix. For the direct Cloud API, create an API key and
use the names returned by `https://ollama.com/api/tags`.

## Tests

```bat
npm test
npm run check
```

## Troubleshooting

- `EADDRINUSE`: another process owns the port. Check with
  `netstat -ano | findstr :8799` and stop the process, or start with `--port`.
- The panel is unreachable from another machine: by design. Use `127.0.0.1`.
- Antivirus blocks `node` on first run: allow the executable or the folder.

## Uninstall

```bat
npm uninstall -g ollama-gateway
```

Delete `%APPDATA%\ollama-gateway` separately if you no longer need the
configuration and logs.
