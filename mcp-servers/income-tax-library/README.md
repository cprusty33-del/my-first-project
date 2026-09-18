# Income Tax Library MCP server

An MCP (stdio) server that lets Claude pull case laws, circulars and notifications from
your **incometaxlibrary.com** subscription and draft appeals, replies, applications and
writ petitions from them.

Node 18+, no dependencies.

## Why no endpoints are shipped

The site is behind a login and was **not reachable from the machine this server was
written on** (the session's egress policy refused the host), so its search/case URLs
could not be observed. Nothing about its request format is assumed here. Instead,
`npm run discover` reads the site's own forms and links on your machine and verifies
each candidate request before saving it to `config.json`. Until a recipe exists, the
retrieval tools fail with an explicit message rather than fetching a guessed URL.

## Setup

1. `npm run setup` — creates `config.json` from the example and prints what is still missing.
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

With the cookie in place, the server learns the requests itself:

```bash
npm run discover              # report only
npm run discover -- --write   # save the recipes into config.json
```

or ask Claude: *"discover the Income Tax Library endpoints and save them"* →
the `itl_discover_endpoints` tool.

What it does: fetches `/` and `/dashboard` with your session, reads the **real
forms** (action, method, field names) and the **real links** on those pages, maps
field names to `{query}` / `{taxType}` / `{year}` / `{month}` / `{page}`, derives the
case-law URL shape (e.g. `/case-law/{id}`) from links that actually appear, then
**issues each candidate request and verifies the response** before proposing it. A
login wall is reported, never worked around. Nothing is written unless you pass
`--write` / `write: true`.

Anything it cannot resolve stays unset and is listed under `unresolved`. Capture
those by hand: run the action in the browser with DevTools → Network open, then
tell Claude, e.g. *"Set the search endpoint: GET /case-law/search with query
q={query} and page={page}"* → `itl_set_endpoint`.

Placeholders available in a recipe: `{query}`, `{taxType}`, `{year}`, `{month}`,
`{page}`, `{id}`. Query/form entries whose placeholder is not supplied at call time are
dropped from the request.

## Tools

| Tool | Purpose |
| --- | --- |
| `itl_status` | Config, auth state, which recipes exist, workspace path |
| `itl_login` | Form login (login mode only) |
| `itl_probe` | Fetch any path on the site; manual endpoint discovery |
| `itl_discover_endpoints` | Learn and verify the search/recent/document requests from the site's own pages |
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
