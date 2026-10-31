# Roadmap

Status: **v0.1.0**. This is a direction, not a promise. Priorities change with
real usage, issues and security findings.

The sequence below was accepted on 2026-10-31. Each phase has a release gate; a
phase is done when the gate is met, not when the code exists.

## Vision

Any client that speaks the Anthropic Messages API should be able to talk to any
model you can run or rent, locally or in the cloud, without changing the client
and without a telemetry middleman.

The gateway is the thinnest useful layer between a client and a model runtime:
it translates model names, keeps the wire format intact, and gets out of the
way. It is not a model host, a reseller, or a hosted service.

## Principles

- **Local-first.** Bind to loopback, keep credentials on the machine, no
  telemetry, no phone-home.
- **Provider-neutral.** Ollama is the first backend, not the only one.
- **Transparent.** No hidden prompt changes unless the operator configures
  them; no fabricated model output unless a filter is explicitly configured.
- **Secure by default.** Metadata-only logs, capture off, secrets never returned
  to the browser, strict admin origin checks.
- **Small core.** One server file, no runtime dependencies, readable in an
  afternoon.
- **No lock-in.** Plain JSON config, plain HTTP, Apache-2.0 license.

## 0.1 Foundation (current)

- Single-file gateway for local Ollama and Ollama Cloud.
- Live mode switching and per-mode model maps.
- Admin panel, metadata usage log, optional capture and request filters.
- npm package, CI on Node 20/22/24, publish workflow with provenance.
- Test suite with a fake upstream and security regression tests.

## 0.2 Global UX (next)

- **English-first admin panel** with Turkish preserved: language toggle and
  browser auto-detection. English CLI output and error messages.
- Model discovery: list upstream models, validate a map, show a capability
  hint instead of guessing.
- Config import/export and a safe "reset to defaults" action.
- Screenshots, a short demo, and a documentation site.
- Docker image with an explicit auth model (loopback is not enough inside a
  container; the admin surface needs a documented design before shipping it).
- Package channels: Homebrew, winget, Scoop.
- Client recipes for Claude Code, Cline, Continue and other
  Anthropic-compatible tools.
- Accessibility pass and a mobile-friendly panel.

## 0.3 Any backend

- Adapters: Ollama, LM Studio, llama.cpp server, OpenAI-compatible endpoints.
- Routing rules by model pattern, tag, header or client key.
- Fallback chains and health-based routing.
- Streaming translation between provider formats.
- Capability matrix: tools, images, thinking blocks, token counting.
- Per-upstream latency and token accounting.

## 0.4 Operator mode

- Multiple client keys with per-key quotas.
- Rate limiting and concurrency control.
- Prometheus/OpenMetrics endpoint and structured logs.
- Service installers: systemd, launchd, Windows service.
- Audit trail without prompt content.
- Hardened container image and a threat model document.

## 0.5 Ecosystem

- Plugin API for adapters and request middleware.
- Community model recipes and a benchmark harness.
- Compatibility test suite that runs against real clients.
- Translations for the panel and documentation.

## 1.0

- Stable configuration schema and HTTP contract.
- Independent security review.
- Reproducible releases with signed npm provenance.
- Long-term support and deprecation policy.

## Release gates

### v0.1.0: first public release

- [x] Test suite, clean npm tarball
- [x] README, LICENSE, NOTICE, LEGAL, SECURITY, architecture
- [ ] Git identity and first commit
- [ ] GitHub repository and green CI on Ubuntu and Windows
- [ ] npm publish and package page
- [ ] `v0.1.0` tag and release notes

### v0.2.0: global launch

- [ ] English-first panel with EN/TR toggle
- [ ] English CLI output and errors
- [ ] Screenshots and a short demo
- [ ] Documentation site
- [ ] Docker image with an explicit auth model
- [ ] Homebrew, winget and Scoop packages
- [ ] Client recipes: Claude Code, Cline, Continue
- [ ] Accessibility and mobile layout pass

### v0.3.0: adapters and routing

- [ ] Inbound adapter: OpenAI Chat Completions
- [ ] Outbound adapters: LM Studio, llama.cpp, OpenAI-compatible
- [ ] Rule-based routing with an explanation for every decision
- [ ] Health-aware fallback and circuit breaking
- [ ] Capability matrix
- [ ] Compatibility fixtures

### v0.4.0: operator mode

- [ ] Token, cost and latency accounting
- [ ] Prometheus/OpenTelemetry metrics and structured logs
- [ ] Per-key quotas and rate limits
- [ ] systemd, launchd and Windows service installers
- [ ] Audit trail without prompt content

### v0.5.0: ecosystem

- [ ] Plugin/middleware API
- [ ] Privacy filters: PII/secret redaction, no-log mode, retention
- [ ] MCP integration for memory and tools
- [ ] Compatibility suite against real clients
- [ ] Panel and documentation translations

### v1.0.0: stable

- [ ] Stable configuration schema and HTTP contract
- [ ] Independent security review
- [ ] Signed releases and SBOM
- [ ] Long-term support and deprecation policy

## Long-term directions under evaluation

These are ideas, not commitments. The verdict reflects the current maintainer
view and may change with usage. The core stays small; features that need state,
identity or a separate UI belong in a plugin, a sidecar or a separate edition.

| Direction | Verdict | Why |
| --- | --- | --- |
| More client protocols (OpenAI-compatible, other SDKs) | Pursue | Speaking only one wire format limits reach; protocol adapters keep the core small. |
| More provider backends (LM Studio, llama.cpp, OpenAI-compatible, cloud APIs) | Pursue | Provider-neutral access is the core promise. |
| Rule-based routing (model pattern, tag, header, client key) | Pursue | Deterministic and explainable; the first routing feature. |
| Task-aware automatic model selection | Later, as a plugin | A classifier adds latency, cost and unpredictability. Only after deterministic routing, with visible decisions and budgets. |
| Health-aware fallback and circuit breaking | Pursue | Reliability is a basic expectation. |
| Cost, token and latency accounting | Pursue | Needed for budgets, quotas and useful reporting. |
| Prometheus/OpenTelemetry metrics and structured logs | Pursue | Standard operator tooling. |
| Privacy filters (secret/PII redaction, no-log mode, retention) | Pursue | Aligns with local-first and enterprise use; must be transparent and configurable. |
| Security hardening (rate limits, mTLS, key vaults, signed config, audit, fuzzing) | Pursue continuously | Security is never "done"; each release adds a layer. |
| Enterprise identity and multi-user management (OIDC/SAML, RBAC, quotas) | Separate edition | Turns a local tool into a multi-tenant server with a different threat model and support burden. Keep the core single-user. |
| Advanced reporting and dashboards | Later, after accounting | Metrics and export are in scope; a BI product is not. |
| RAG and long-term memory | Not in the core | Stateful storage, privacy and retention are a different product. Possible as an explicit sidecar or plugin. |
| Hosted SaaS, marketplace, billing | Not planned | Conflicts with local-first and no-resale principles. |
| Fine-tuning or training | Not planned | Out of scope. |
| Plugin/middleware API | Pursue | The clean way to add routing, redaction, memory and reporting without bloating the core. |
| Client presets and one-command setup | Pursue | Lowers the barrier for new users. |
| Packaging: Docker, Homebrew, winget, Scoop | Pursue | Distribution is part of a global release. |
| English-first UI and documentation i18n | Pursue | Required for a global audience. |
| Compatibility test suite and recorded fixtures | Pursue | Protects the wire contract as adapters multiply. |
| Air-gapped/offline deployment | Later | Valuable for regulated environments; follows packaging and operator mode. |
| Multi-modal capability negotiation | Pursue with adapters | Images and audio depend on the backend; expose capabilities instead of guessing. |
| Benchmark and evaluation harness | Later | Useful once multiple adapters and routing exist. |

## Non-goals

- Reselling, sharing or pooling provider access.
- Bypassing provider limits, billing or guardrails.
- Hosting models.
- Using Claude models without a provider relationship.
- Shipping personal prompts, API keys or captured traffic.

## How to help

- Open an issue with a concrete use case or a failing reproduction.
- Send a pull request that keeps the core small and adds tests.
- Test against a client or backend we do not have and report the result.
- Improve documentation, examples and translations.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.
