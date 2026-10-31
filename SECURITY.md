# Security policy

## Scope and support

Tracer is an unreleased, local source preview. Only the current development source is maintained; no supported release series, security-update SLA or certification is claimed. Keep Node/dependencies current and review changes before upgrading a working project.

The local HTTP server is intended for trusted local use. Do not expose it through a public interface, tunnel or reverse proxy as an authenticated team service. Tracer does not supply that deployment/security boundary. Databases and referenced material can contain sensitive engineering information; protect their filesystem permissions and backups.

## Report privately

Do not post databases, credentials, private documents or exploitable details in public issues. Use [GitHub private vulnerability reporting](https://github.com/jtabke/tracer/security/advisories/new) when the repository enables it. If unavailable, open a minimal issue requesting a private contact channel **without vulnerability details**; no private reporting endpoint or response deadline is promised here.

Include the affected commit, minimal fictional reproduction, impact and relevant sanitized conditions. Do not test against another person's project or running service without permission.
