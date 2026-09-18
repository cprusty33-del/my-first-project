# Income Tax Library MCP server

An MCP (stdio) server that lets Claude pull case laws, circulars and notifications from
your **incometaxlibrary.com** subscription and draft appeals, replies, applications and
writ petitions from them.

Node 18+, no dependencies.

## Why no endpoints are shipped

The site is behind a login and was **not reachable from the machine this server was
written on**, so its search/case URLs could not be observed. Nothing about its request
format is assumed here. You record the real requests once (below) and they are stored in
`config.json`; until then the search tools fail with an explicit message rather than
fetching a guessed URL.

## Setup

1. `cp config.example.json config.json` and set `baseUrl` if it differs.
2. Supply your session:
   - **Cookie mode (simplest):** log in to the site in your browser, copy the request
     `Cookie` header (DevTools → Network → any request → Request Headers) and set it as
     the `ITL_COOKIE` environment variable. Cookies expire — refresh when calls start
     returning the login page.
   - **Login mode:** set `auth.mode` to `"login"`, `auth.loginPath` to the site's login
     endpoint and `auth.loginFields` to its field names, e.g.
     `{"email":"{user}","password":"{pass}"}`; put credentials in `ITL_USER` / `ITL_PASS`
     and call the `itl_login` tool.
3. Register the server with your client, e.g. `claude mcp add`:

```bash
claude mcp add income-tax-library -- node /absolute/path/to/mcp-servers/income-tax-library/server.js
```

Or in a client config file:

```json
{
  "mcpServers": {
    "income-tax-library": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/income-tax-library/server.js"],
      "env": { "ITL_COOKIE": "...", "ITL_CONFIG": "/absolute/path/to/config.json" }
    }
  }
}
```

## Discovering endpoints (one time)

1. In the browser, run a case-law search on the site with DevTools → Network open.
2. Note the request that returns the results: method, path, and query/form field names.
3. Ask Claude to record it, e.g.:
   *"Set the search endpoint: GET /case-law/search with query q={query} and page={page}"*
   → the `itl_set_endpoint` tool writes it into `config.json`.
4. Do the same for `recent` (the dashboard's Tax type / Year / Month filter) and
   `document` (a single case-law page, usually `/…/{id}`).
5. `itl_probe` fetches any path on the site with your session and shows the status,
   text, links and tables — use it to confirm a recipe before recording it.

Placeholders available in a recipe: `{query}`, `{taxType}`, `{year}`, `{month}`,
`{page}`, `{id}`. Query/form entries whose placeholder is not supplied at call time are
dropped from the request.

## Tools

| Tool | Purpose |
| --- | --- |
| `itl_status` | Config, auth state, which recipes exist, workspace path |
| `itl_login` | Form login (login mode only) |
| `itl_probe` | Fetch any path on the site; endpoint discovery |
| `itl_set_endpoint` | Save a request recipe into `config.json` |
| `itl_search_case_laws` | Search using the `search` recipe |
| `itl_recent_case_laws` | Recent case laws using the `recent` recipe |
| `itl_get_document` | Full text of one case law / circular / notification |
| `itl_save_case_law` | Save an authority (citation + source URL + text) to the workspace |
| `itl_list_templates` | Drafting templates and their fields |
| `itl_draft` | Render a draft from a template, authorities and facts |

Requests to any host other than `baseUrl` are refused.

## Drafting templates

`form35-cita-appeal`, `form36-itat-appeal`, `notice-reply`, `penalty-reply`,
`rectification-154`, `stay-application`, `writ-petition`, `gst-scn-reply`,
`gst-appeal-apl01`.

They are **skeletons**, not precedent banks. Two guards are built in:

- A field you do not supply is rendered as `[TO BE FILLED: name]` and listed in
  `missingFields` — the draft never fills a blank with an invented fact.
- An authority passed without a `sourceUrl` is printed with a
  `⚠ NOT VERIFIED` line and counted in `unverifiedAuthorities`, so a citation that did
  not come out of the library is visible before filing.

Every draft still needs professional review. Forms, limitation periods, fees and
pre-deposit requirements must be checked against the statute in force for the relevant
year.

## Output

`config.workspace` (default `./itl-workspace`): `case-laws/` for saved authorities,
`drafts/` for generated drafts.

## Test

```bash
npm run selftest   # drives the server over stdio against a local stub site
```
