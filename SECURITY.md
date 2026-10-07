# Security

Vega Studio is a local browser editor without a backend, accounts, analytics,
or live Elasticsearch connections. Exported Kibana specifications can query
Elasticsearch when executed inside Kibana; that environment controls access.

Project files contain inline rows, query configuration, and response fixtures.
Do not include passwords, access tokens, real private records, or credentials.
Theme and Properties width use local storage; projects are saved by downloading
JSON, not automatically persisted. Clipboard actions use browser permissions.

Imported projects are schema-validated. Arbitrary Vega import is unsupported.
This does not make arbitrary user-supplied files safe to share or execute in
other applications. Dependency advisories are checked with `npm audit`.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** feature if the
maintainer has enabled private reporting. If unavailable, ask the maintainer
for a private contact without posting exploit details or sensitive data in a
public issue. A private reporting contact must be established before publication.

No response-time guarantee or supported-release security policy has been
established yet. The repository is being prepared for its first public release.
