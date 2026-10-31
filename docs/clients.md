# Client recipes

Any client that lets you set an Anthropic-compatible base URL can use the
gateway. The recipes below assume the gateway runs on
`http://127.0.0.1:8799` and that a model is mapped in the panel; replace the
model name with whatever your client sends and your map translates.

The gateway ignores the client token. Most clients require one, so use any
placeholder such as `ollama`.

## Claude Code

macOS and Linux:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:8799"
export ANTHROPIC_AUTH_TOKEN="ollama"
claude --model claude-opus-5
```

Windows (cmd):

```bat
set ANTHROPIC_BASE_URL=http://127.0.0.1:8799
set ANTHROPIC_AUTH_TOKEN=ollama
claude --model claude-opus-5
```

To keep it for every shell, put the two `export` lines in `~/.zshrc` or
`~/.bashrc`, or use `setx` on Windows.

Anthropic documents that routing Claude Code to non-Claude models through a
gateway is unsupported. You are responsible for the terms you accept.

## Continue

Add a model entry to `~/.continue/config.json` (or `config.yaml`):

```json
{
  "models": [
    {
      "title": "Local gateway",
      "provider": "anthropic",
      "model": "claude-opus-5",
      "apiBase": "http://127.0.0.1:8799",
      "apiKey": "ollama"
    }
  ]
}
```

`apiBase` must be the gateway root, without `/v1`.

## Cline and other VS Code extensions

1. Open the extension settings and choose the **Anthropic** provider.
2. If the version offers a base URL field, set it to `http://127.0.0.1:8799`.
   Older builds only accept the official endpoint and cannot be pointed at a
   gateway.
3. Set the API key to any placeholder and pick the model name your map uses.

Extensions that only speak the OpenAI Chat Completions format need an inbound
adapter, which is on the roadmap.

## A quick check without a client

```bash
curl -s http://127.0.0.1:8799/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: ollama" \
  -d '{"model":"claude-opus-5","max_tokens":32,"messages":[{"role":"user","content":"hello"}]}'
```

A mapped model returns an Anthropic-shaped message with the upstream model name
in the `model` field.

## When it does not work

| Symptom | Likely cause |
| --- | --- |
| `401` from the gateway | Cloud mode without a stored API key; open the panel and save one |
| `502` from the gateway | The upstream is not reachable; run **Test the connection** |
| Upstream `404` or an unknown-model error | The map target is wrong; run **Discover models** and compare |
| Empty or truncated answers | The mapped model does not support the requested features; check its page on ollama.com |
| The client keeps its own model | The client ignores the base URL or its model setting |
