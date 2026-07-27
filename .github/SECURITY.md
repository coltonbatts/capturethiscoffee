# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private **Report a vulnerability** form in this repository's
Security tab. Include:

- the affected surface and route;
- reproduction steps using fictional data;
- the expected and observed behavior;
- the likely impact; and
- a suggested mitigation, if known.

Do not include production share tokens, passwords, Supabase service-role keys,
Apple signing assets, private crew data, or live client records. If evidence
contains sensitive data, describe it first and wait for a secure transfer
method.

## Scope

Security-sensitive areas include:

- authentication and invited-account access;
- Supabase Row Level Security and Storage policies;
- production share-token scope, expiry, and revocation;
- server-only service-role usage;
- locally cached iOS production data and Keychain sessions; and
- public runner, label, privacy, and support routes.

General product support belongs at
[coffee.capturethis.com/support](https://coffee.capturethis.com/support), not in
a vulnerability report.
