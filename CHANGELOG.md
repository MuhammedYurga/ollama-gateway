# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
