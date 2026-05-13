# Security Notes (CodeQL-focused)

## Safe DOM helpers (`src/lib/safe-dom.js`)

- Dynamic text is always appended as literal text and is never parsed as HTML.
- `el()` only appends trusted nodes created by the safe-dom helper itself (plus text nodes).
  Untrusted external nodes are downgraded to plain text via `textContent`.
- Dangerous attribute paths are blocked (`on*` string handlers, `srcdoc`), and URL-like attributes
  are normalized through `safeHref()`.

## OAuth request signing (`scripts/node/tweet-gold-price.js`)

- Tweet posting uses OAuth 1.0a request signing (HMAC-SHA256) to authenticate API requests.
- This HMAC is request-auth integrity logic, not password storage or password verification.
- Signing secrets are never logged and are not embedded in plaintext in the Authorization header.

## CodeQL workflow source of truth

- `.github/workflows/codeql.yml` is the advanced CodeQL workflow in this repository.
- Concurrency now keeps PR scans cancellable for fast feedback, while allowing `main` scans to
  finish without noisy cancellation churn.
- Docs-only changes are excluded from push/PR scans to reduce non-actionable CodeQL noise.
