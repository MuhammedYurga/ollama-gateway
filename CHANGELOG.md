# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- English-first admin panel with a full Turkish translation and browser
  language detection, switchable from the header.
- Model discovery from the upstream `/api/tags` list, with family, parameter
  size, quantization and size, cached for 30 seconds.
- Map validation: a target that the upstream does not list is highlighted
  before it reaches a client.
- Capability badges for mapped models: `/api/show` is queried for the models in
  use and a missing tool capability is flagged, because clients such as Claude
  Code send tool definitions.
- One-click test message that goes through the active model map and reports the
  latency and the first characters of the reply.
- Setup checklist on the overview tab and a copy-ready client snippet for
  macOS, Linux and Windows.
- Configuration export and import without secrets, and a reset that keeps or
  rotates the panel password.
- Panel keyboard navigation, screen-reader labels, a skip link and a mobile
  layout.
- Client recipes for Claude Code, Continue and generic Anthropic-compatible
  clients, a macOS launchd guide and a Windows service guide.

### Changed

- CLI output, server messages, configuration warnings and admin API errors are
  English.
- The system addon header is now `# STYLE INSTRUCTIONS (gateway addon)`.
- Recent request rows use the stable status tokens `count`, `block` and
  `error` instead of display strings.

## [0.1.0] - 2026-10-31

### Added

- Single-file gateway with two upstream modes: local Ollama and Ollama Cloud.
- Browser admin panel for connection mode, model maps, request filters, style
  addon, logging and status.
- Live configuration reload; no restart when switching modes.
- Estimated `count_tokens` responses for upstreams that do not implement it.
- Optional request capture and usage log, both local only.

### Security

- The admin API never returns the Ollama Cloud API key or the panel password.
- Admin writes require `Content-Type: application/json`; `Host` and `Origin` are
  checked against the listening port to block CSRF and DNS rebinding.
- The panel token is accepted only in a request header, compared in constant
  time, and kept in `sessionStorage` rather than persistent storage.
- Client `Authorization` and `x-api-key` headers are stripped in both upstream
  modes; cloud mode adds the configured Ollama key.
- Request bodies are capped at 32 MB; aborted clients cancel the upstream
  request.
- The panel is served with a strict CSP and no inline script.
- API keys, logs and captures are excluded from version control and the npm
  tarball.
- Runtime data is written outside the package directory on global installs.

### License

- Apache-2.0 with a NOTICE file. Derivative distributions must retain the
  attribution notices and mark modified files.
