# Contributing

Thanks for taking the time to improve the gateway. This project is small on
purpose; the best contributions keep it small while making it more useful.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Requirements: Node.js 20 or newer, npm, and an Ollama installation or a fake
upstream for tests.

```bash
npm test
npm run check
npm pack --dry-run
```

The test suite starts the real server on an ephemeral port with a fake upstream;
no Ollama instance or API key is required.

## Project layout

| Path | Purpose |
| --- | --- |
| `anthropic-proxy.js` | HTTP server, config, CLI, upstream transport |
| `panel.html` | Admin panel markup and styles |
| `panel.js` | Admin panel behavior |
| `test/config.test.js` | Pure configuration tests |
| `test/server.test.js` | End-to-end tests with a fake upstream |
| `proxy-config.example.json` | Documented configuration example |
| `README.md`, `LEGAL.md`, `SECURITY.md` | User and compliance docs |

## Design rules

1. **No runtime dependencies.** Node built-ins only. A new dependency needs a
   strong reason and a maintainer decision.
2. **Keep the server in one file.** The panel assets are separate; the server
   logic is intentionally readable end to end.
3. **Local by default.** Do not add remote binding, multi-tenant auth, or
   network exposure without an explicit security design.
4. **Privacy defaults stay conservative.** New logging or capture features are
   off by default and documented in the README.
5. **Never ship secrets.** Configuration files, captures and logs are ignored.
   Tests must not depend on a real API key.
6. **Fail loud.** A misconfiguration should produce a clear error, not a silent
   fallback that looks successful.

## Tests

- Add a test for every behavior change. Security fixes need a regression test.
- Keep tests deterministic: ephemeral ports, fake upstreams, temporary data
  directories.
- Run `npm test` and `npm run check` before opening a pull request.
- Do not weaken or skip existing tests to make a change pass.

## Commit messages and pull requests

- Commit messages are English, short and descriptive.
- Use the passive voice, for example: "Admin API hardened against cross-site
  requests".
- No co-author trailers and no assistant attribution.
- Keep each pull request focused. Explain the problem, the change and the
  trade-offs.
- Update `README.md` or `LEGAL.md` when behavior or compliance statements
  change.
- Do not include generated traffic, logs, screenshots with prompts, or keys.
- The pull request template asks for the verification you ran; fill it in.

## License

By contributing, you agree that your contribution is licensed under the
project's Apache-2.0 license. Keep copyright headers and the NOTICE file intact.

## Translations

The admin panel is currently Turkish. English-first UI with a language toggle is
on the roadmap. Documentation is English-first; focused Turkish guides are
welcome under `docs/`.

## Security

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).

## Questions

Open a discussion or an issue with the `question` label. Include your OS, Node
version, upstream mode and the smallest reproduction you can produce.
