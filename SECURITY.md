# Security policy

## Supported versions

The `main` branch and the latest published npm version are supported.

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting**: the repo's *Security* tab →
*Report a vulnerability*. Please do not open public issues, discussions, or pull
requests for potential vulnerabilities — even speculative ones.

Expect an acknowledgement within 72 hours. If you don't hear back, follow up
through the same private channel.

## What counts as a security issue

ng-point's core promise is *dev-mode only, secrets redacted at capture*. Issues
that break that promise are security issues:

- **Any path where ng-point code runs in a production build.** The provider is
  constant-folded behind `ngDevMode`; a leak into runtime chunks is the
  highest-severity report this repo can receive.
- **Redaction bypass**: a secret shape (JWT, API key, token, or a configured
  `sensitiveSelectors` / `extraRedactionPatterns` target) that reaches the
  clipboard, queue, or block preview un-redacted.
- **Injection**: captured element content (attributes, text) escaping into the
  overlay's DOM in a way that executes or manipulates it.
- Anything in the landing site that turns user-supplied input into executable
  content (there should be none — but that's the point of checking).

## Non-goals

- Content the user **deliberately** copies or types — ng-point is an
  explicit-gesture tool; a user pasting their own secrets into their own agent
  is not a vulnerability.
- Dev-server exposure generally — dev mode is a locally trusted context by
  definition. The line is what the tool does automatically, not what the
  developer does on purpose.
- The unpublished MCP package (`packages/ng-point-mcp`, deferred) — not part of
  the shipped attack surface yet; still feel free to report anything you find
  there.
