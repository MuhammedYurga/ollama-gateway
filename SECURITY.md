# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately
through GitHub's "Report a vulnerability" flow on the repository's Security tab,
or by contacting the maintainer listed in `package.json`.

Include the affected version, a minimal reproduction, and the impact you
observed. You can expect an initial response within a few days.

## Scope

The gateway binds to `127.0.0.1` by default and is meant to run on the same
machine as the client that uses it. Exposing it to a network, putting it behind
a public reverse proxy, or sharing one instance between people is outside the
supported configuration and is your responsibility.

The admin API can read and change the configuration, including the Ollama Cloud
API key. If you set an admin token, the panel asks for it; if you leave it
empty, anyone who can reach the port can change the settings.

## Secret handling

- API keys are stored in the local configuration file, are never returned by
  the admin API, and are never written to logs.
- `proxy-config.json`, logs and captures are excluded by `.gitignore`. Do not
  commit them.
- Rotate a key immediately if it was exposed in a screenshot, log, or public
  repository.
