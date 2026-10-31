# Provider adapters (0.3 design)

Status: design note, not implemented. It describes the seam the 0.3 work will
cut, so the core stays one file and each adapter stays small.

## Goal

One inbound protocol (Anthropic Messages) reaches any runtime that can serve a
compatible model, without the client knowing which runtime it hit.

Today the gateway has two transports for one provider: the Ollama daemon over
plain HTTP and ollama.com over HTTPS with a Bearer key. Both speak
`/v1/messages`, so the current code only chooses a socket and adds a header.

That stops working the moment an upstream speaks OpenAI Chat Completions
instead. The adapter layer exists to absorb that difference in one place.

## Contract

An adapter is a plain object with no state of its own:

| Member | Purpose |
| --- | --- |
| `id` | `ollama`, `openai-compatible`, ... |
| `label` | Human name for the panel |
| `baseUrl(config)` | Resolves the base address |
| `headers(config)` | Auth and transport headers |
| `path(opts)` | Upstream path for a request kind |
| `speaks` | `anthropic` or `openai` |
| `capabilities(config)` | Async capability lookup for a model list |
| `prepare(body)` | Optional request rewrite before send |
| `translateResponse(body)` | Only for `speaks: 'openai'` |
| `translateStream(state)` | Only for `speaks: 'openai'` |

Adapters never touch credentials of the client and never log prompt content.
Every adapter is exercised by a fake upstream in the test suite.

## Translation boundary

The expensive half is `speaks: 'openai'`: the gateway must map messages, tools,
tool results, stop reasons, usage and streaming deltas in both directions.
That code belongs in `adapters/openai.js`, not in the server file, with fixtures
recorded from a real upstream. It ships only when the fixtures cover:

- text-only request and response
- tool definition, tool call and tool result round trip
- streaming text with a stop reason
- streaming tool call arguments split across deltas
- an upstream error passed through with its status

Until those fixtures exist, an OpenAI-compatible backend is a preview flag, not
a default.

## Routing

Deterministic and explainable:

1. A rule matches on model pattern, request header, model tag or client key.
2. The first match wins. The decision and its reason are written to the usage
   log without prompt text.
3. No match falls back to the configured default upstream.

A classifier that chooses a model by task is explicitly later and out of scope
for 0.3. When it arrives it must be a plugin, must show its decision, and must
have a token budget.

## Capability matrix

Capabilities are read, not guessed: `/api/show` for Ollama, provider metadata
otherwise. The matrix powers warnings ("this model does not declare tool
support") and never silently blocks a request. The panel already shows the tool
bit for mapped models.

## Failure policy

- Health-aware fallback: a failing upstream is skipped for a short window, and
  the fallback is recorded with the reason.
- Circuit breaking: N consecutive failures open the circuit, one probe closes
  it.
- A request is never answered by a different model without a logged reason.

## Non-goals

- Multi-tenant identity, quotas and billing (separate edition).
- RAG, memory and long-term storage (sidecar or plugin).
- Automatic model selection by task (plugin, later).
- Hosted relay or resale.

## Sequence

1. Extract the adapter contract from the current local/cloud branches; no new
   provider, behavior unchanged, tests unchanged. This is the safe refactor.
2. Add the OpenAI-compatible outbound adapter behind a config flag, with
   fixtures.
3. Add rule-based routing on top of the adapter list.
4. Add health fallback and the circuit breaker.
5. Only then evaluate a task-aware selector.

Each step lands with tests and a changelog entry; none of them may grow the
server file by more than the seam needs.
