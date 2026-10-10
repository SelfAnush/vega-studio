# Security

Vega Studio is a browser-based visual editor without an application backend, accounts,
or live Elasticsearch connections. Exported Kibana specifications can query
Elasticsearch when executed inside Kibana; that environment controls access.

Production builds include Vercel Web Analytics for page views. The application
does not send project contents, sample rows, query configuration, or editor actions
as analytics events. Analytics is disabled during development and can be disabled
for production builds with `VITE_WEB_ANALYTICS=false`; see
[deployment configuration](docs/configuration.md#web-analytics).

Project files contain inline rows, query configuration, and response fixtures.
Do not include passwords, access tokens, real private records, or credentials.
Theme and Properties width use local storage; projects are saved by downloading
JSON, not automatically persisted. Clipboard actions use browser permissions.

Imported projects are schema-validated. Arbitrary Vega import is unsupported.
This does not make arbitrary user-supplied files safe to share or execute in
other applications. Dependency advisories are checked with `npm audit`.

## Reporting a vulnerability

Use [private vulnerability reporting](https://github.com/SelfAnush/vega-studio/security/advisories/new)
when enabled, also available under **Security → Report a vulnerability**.
If unavailable, ask the maintainer for a private contact without posting exploit
details or sensitive data in a public issue. The maintainer should enable private
reporting as part of making the repository public.

Security reports are reviewed by the maintainer; no response-time guarantee is provided.
