## Summary

What changed and why.

## Branch

- [ ] Short-lived branch from `main` with a conventional prefix (`feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`)
- [ ] Squash merge; the title follows the commit rule

## Verification

- [ ] `npm test`
- [ ] `npm run check`
- [ ] Manual check (describe the client, mode and request)

## Security and privacy

- [ ] No API keys, prompts, captured traffic or personal data in the diff
- [ ] Logging and capture defaults are unchanged, or the change is documented
- [ ] Admin surface, auth and origin checks still hold
- [ ] Client credentials are not forwarded upstream

## Documentation

- [ ] README, LEGAL or configuration example updated when behavior or claims changed
- [ ] New configuration fields are documented and validated
