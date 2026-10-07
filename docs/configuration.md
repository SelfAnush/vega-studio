# Configuration and deployment

No `.env` file, API key, database, or server configuration is required. Never
put secrets in `VITE_*` variables: browser build configuration is public.

The development server binds to loopback (`127.0.0.1:5173`). After
`npm run build`, use `npm run preview` to check the production output locally
(normally `http://127.0.0.1:4173`). Preview is for local checks, not production
hosting. A production host serves the contents of `dist/` as static files.

For a repository subpath such as GitHub Pages, build with its actual path:

```sh
npm run build -- --base=/vega-studio/
```

Replace `vega-studio` with the deployment path. Root hosting uses the default
`/`. No deployment, repository URL, or live Kibana compatibility is implied.

## Example Elasticsearch dataset

In **Sample data → Add Elasticsearch dataset**, configure:

| Field | Synthetic example |
| --- | --- |
| Dataset name | `queues` |
| Index pattern | `demo-queues-*` |
| Query DSL body | `{"size": 100, "_source": ["queue", "usage"]}` |
| Dashboard filters/time | Off for this example |
| Response property | `hits.hits._source` |

Use this local response fixture:

```json
{"hits":{"hits":[{"_source":{"queue":"demo","usage":42}}]}}
```

This path extracts rows from each hit's `_source`. Bind a bar chart category
to `queue` and value to `usage`. Studio previews the fixture only; Elasticsearch
export writes Query DSL configuration for Kibana. Do not add credentials.
Dashboard context/time options have additional validation described in
[compatibility](compatibility.md) and [bindings](bindings.md).

## Release environments

`.nvmrc` records the verified Node version. `package-lock.json` pins resolved
dependencies; use `npm ci` for reproducible installs. `CI=true` prevents browser
tests from silently reusing an existing development server. Browser tests bind
to port 5173; stop another server on that port before CI runs.
