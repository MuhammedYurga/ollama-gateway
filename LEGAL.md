# Legal and acceptable use

This document states how the project positions itself and what users are
responsible for. It is not legal advice. Terms change; verify the current text
of every provider agreement you are subject to.

## Independence

This project is an independent, unofficial bridge. It is not affiliated with,
endorsed by, sponsored by, or supported by Anthropic PBC or Ollama.

It provides no model access and no API keys. You must supply your own Ollama
credentials and comply with Ollama's Terms of Service.

No Claude model is used. Claude model names are mapped to Ollama models only so
that Anthropic-format clients can send requests.

Anthropic does not support routing Claude Code to non-Claude models through any
gateway. Use at your own risk.

## What the software does, technically

- It listens on `127.0.0.1` and accepts Anthropic Messages API shaped requests.
- It rewrites the `model` field according to a local mapping and forwards the
  request to the upstream you configure: a local Ollama daemon or
  `https://ollama.com` with your own key.
- It does not contact Anthropic inference services, does not use Anthropic
  credentials, and does not validate or resell access to any provider.
- It can optionally append instructions to the `system` prompt, estimate token
  counts, filter requests you define, and log metadata or full bodies locally.
  These features are off or minimal by default.

## Your responsibilities

You are responsible for complying with Anthropic's Consumer Terms, Commercial
Terms, and Usage Policy, and with Ollama's Terms of Service, as applicable to
how you use your clients and accounts.

In particular:

- Do not use this software to resell, share, or provide access to any provider's
  service to third parties.
- Do not use it to bypass usage limits, concurrency limits, authentication,
  guardrails, or other technical restrictions.
- Do not misrepresent which product or client is being used, or imply that
  Anthropic or Ollama endorses this project.
- Do not use it to build or train a competing model from a provider's service.
- Keep your credentials confidential. You are responsible for activity under
  your accounts.
- Some clients send telemetry or version checks directly to their vendor,
  independent of this gateway. Those communications remain governed by that
  vendor's terms.

## Trademarks

"Anthropic", "Claude", "Ollama" and related names and logos are trademarks of
their respective owners. This project uses those names only to describe
compatibility and interoperability. The Apache-2.0 license grants no trademark
rights.
Do not use the names or logos in a way that suggests sponsorship, endorsement,
or affiliation. Do not use the project name or its assets as your own branding.

The npm package and repository do not use the Anthropic or Claude names.
"Ollama" appears only descriptively, as the name of the upstream software this
gateway talks to; it is a trademark of its owner.

## Attribution

The project is licensed under Apache-2.0. Redistributions and derivative works
must retain the copyright, patent, trademark and attribution notices from the
source, include a readable copy of the NOTICE file, and mark modified files.
The license does not require attribution in a user interface.

## Request capture and privacy

Request capture is disabled by default. If enabled, prompts and code may be
written to local disk in plain text. Do not enable it on data you are not
allowed to store.

When capture is disabled, the usage log records metadata only: time, token
counts, duration, status, mode, requested model, bucket and user agent. Prompt
heads are a separate opt-in setting and are off by default.

If you process personal data, you are responsible for the applicable privacy
law (for example GDPR, KVKK, or CCPA), including lawful basis, retention and
deletion. The project provides no encryption at rest and no access control
beyond the local admin password.

## Provider terms (checked 2026-10-31)

The following are selected clauses that informed this document. They are quoted
for context only; read the full agreements.

**Anthropic Consumer Terms** (https://www.anthropic.com/legal/consumer-terms)

- Prohibits sharing account credentials or API keys.
- Prohibits reverse engineering the services.
- Prohibits access through automated or non-human means in the contexts
  described there.
- Prohibits developing competing products or services.

**Anthropic Usage Policy** (https://www.anthropic.com/legal/aup)

- "Resell, proxy, or otherwise provide access to Claude through unauthorized
  means."
- "services that route requests through consumer subscriptions or misrepresent
  the product or client being used."
- "Intentionally bypass or interfere with capabilities, restrictions, or
  guardrails established within our products."
- "Engage in actions or behaviors that circumvent the guardrails or terms of
  other platforms or services."

**Anthropic Commercial Terms** (https://www.anthropic.com/legal/commercial-terms)

- Bars using the services to build a competing product or to train competing
  models, and resale except as expressly approved.

**Anthropic trademark guidelines** (https://www.anthropic.com/legal/trademark-guidelines)

- Trademarks may be used only as permitted, and not in a way that implies
  sponsorship, endorsement, or affiliation.

**Claude Code gateway documentation** (https://code.claude.com/docs/en/gateways)

- "Anthropic doesn't endorse, maintain, or audit other gateway products, and
  doesn't support routing Claude Code to non-Claude models through any gateway."
- Claude Code still sends version checks and downloads directly to Anthropic.

**Ollama Terms of Service** (https://ollama.com/terms)

- "Use our services to develop competing products."
- "Reverse engineer, decompile, or disassemble our software (except as permitted
  by law)."
- "Use automated means to access our services without permission."
- You are responsible for maintaining the confidentiality of your account
  credentials.
- The terms grant no rights to use Ollama branding without permission.

**Ollama Cloud documentation** (https://docs.ollama.com/cloud)

- Create an API key and keep it out of browser code and source control.
- Ollama processes cloud prompts and responses to answer requests and states
  that it does not use them to train models.

**npm package name guidelines** (https://docs.npmjs.com/package-name-guidelines)

- Do not use someone else's trademarked name, and do not choose a name that
  confuses authorship.

## Unknowns

- Whether Anthropic treats a non-Claude backend behind its clients as a breach
  of its terms, as opposed to merely unsupported, is not answered by the public
  text.
- Official support for custom gateways in Claude Desktop was not documented in
  the sources reviewed.
- Ollama's terms do not contain a separate acceptable-use policy or an explicit
  resale clause; the automated-access clause is the main hook, and "permission"
  is undefined there.

## No warranty

Provided as is, without warranty, under the [LICENSE](LICENSE). The authors are
not liable for account suspension, data loss, costs, or other damages arising
from use of the software or of any provider service.

If you are uncertain whether your use is permitted, ask the provider or your
legal counsel before deploying it.
