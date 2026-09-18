#!/usr/bin/env node
'use strict';
/**
 * MCP server for Income Tax Library (incometaxlibrary.com).
 *
 * Retrieval is entirely driven by request recipes you put in config.json —
 * the server ships with none, because the site's real endpoints must be
 * observed, not guessed. Use itl_probe to discover them and itl_set_endpoint
 * to record them.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const conf = require('./src/config');
const http = require('./src/http');
const html = require('./src/html');
const drafts = require('./src/drafts');
const discovery = require('./src/discover');

const NAME = 'income-tax-library';
const VERSION = '0.1.0';
const PROTOCOL = '2024-11-05';

let cfg = conf.load();
http.seedJar(cfg);

const S = {
  str: (d) => ({ type: 'string', description: d }),
  num: (d) => ({ type: 'number', description: d }),
  bool: (d) => ({ type: 'boolean', description: d }),
  arr: (d, items) => ({ type: 'array', description: d, items: items || { type: 'string' } }),
  obj: (d) => ({ type: 'object', description: d, additionalProperties: true })
};

const TOOLS = [
  {
    name: 'itl_status',
    description: 'Show the server configuration: base URL, authentication mode, whether a session cookie is loaded, which endpoint recipes are configured, and the workspace path. Call this first — search and document tools fail until their recipes exist.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const ep = cfg.endpoints || {};
      return {
        configFile: cfg._path,
        configFileExists: cfg._exists,
        baseUrl: cfg.baseUrl,
        authMode: cfg.auth.mode,
        cookieEnv: cfg.auth.cookieEnv,
        cookiesLoaded: http.cookieNames(),
        endpointsConfigured: Object.fromEntries(Object.keys(conf.DEFAULTS.endpoints).concat(Object.keys(ep)).filter((v, i, a) => a.indexOf(v) === i).map((k) => [k, Boolean(ep[k])])),
        workspace: cfg.workspace,
        templates: drafts.listTemplates().map((t) => t.id)
      };
    }
  },
  {
    name: 'itl_login',
    description: 'Perform a form login against the configured auth.loginPath using the credentials in the environment, storing the resulting session cookies for this process. Only usable when auth.mode is "login".',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const res = await http.login(cfg);
      return { status: res.status, url: res.url, cookiesNow: http.cookieNames(), bodyPreview: html.toText(res.body).slice(0, 800) };
    }
  },
  {
    name: 'itl_probe',
    description: 'Fetch any path on the configured site with the current session and return the status, page text, links and tables. Use this to discover how search and case-law pages are actually requested, before recording them with itl_set_endpoint. Requests to other hosts are refused.',
    inputSchema: {
      type: 'object',
      properties: {
        path: S.str('Path or full URL on the configured site, e.g. "/dashboard" or "/search?q=section+270AA".'),
        method: S.str('HTTP method, default GET.'),
        query: S.obj('Query string parameters.'),
        form: S.obj('Form fields to POST as application/x-www-form-urlencoded.'),
        body: S.str('Raw request body (sent as JSON unless a Content-Type header is given).'),
        headers: S.obj('Extra request headers.'),
        limit: S.num('Max characters of extracted text to return, default 20000.')
      },
      required: ['path']
    },
    handler: async (a) => {
      const res = await http.request(cfg, { method: a.method || 'GET', path: a.path, query: a.query, form: a.form, body: a.body, headers: a.headers });
      return { request: { method: a.method || 'GET', url: res.url }, status: res.status, contentType: res.contentType, ...html.summarize(res, { limit: a.limit }) };
    }
  },
  {
    name: 'itl_discover_endpoints',
    description: 'Work out how this site is actually queried: fetch the seed pages with your session, read their real forms and links, verify each candidate request, and (with write=true) save the search/recent/document recipes into config.json. Nothing is guessed — candidates come only from the site\'s own HTML and are tested before being proposed.',
    inputSchema: {
      type: 'object',
      properties: {
        seeds: S.arr('Pages to learn from. Default: "/" and "/dashboard".'),
        sampleQuery: S.str('Word used to test a candidate search, default "penalty".'),
        write: S.bool('Save the chosen recipes into config.json. Default false (report only).')
      }
    },
    handler: async (a) => discovery.discover(cfg, { seeds: a.seeds, sampleQuery: a.sampleQuery, write: a.write === true })
  },
  {
    name: 'itl_set_endpoint',
    description: 'Record a request recipe in config.json so the search/recent/document tools can use it. The recipe may contain {placeholders} (e.g. {query}, {year}, {month}, {taxType}, {id}) which are filled at call time; query/form entries whose placeholder is not supplied are dropped.',
    inputSchema: {
      type: 'object',
      properties: {
        name: S.str('Recipe name: "search", "recent", "document", or any custom name.'),
        method: S.str('HTTP method, default GET.'),
        path: S.str('Path, may contain placeholders, e.g. "/case-law/{id}".'),
        query: S.obj('Query parameters, e.g. {"q":"{query}","page":"{page}"}.'),
        form: S.obj('Form fields for POST recipes.'),
        headers: S.obj('Extra headers.')
      },
      required: ['name', 'path']
    },
    handler: async (a) => {
      cfg.endpoints = cfg.endpoints || {};
      cfg.endpoints[a.name] = { method: a.method || 'GET', path: a.path, ...(a.query ? { query: a.query } : {}), ...(a.form ? { form: a.form } : {}), ...(a.headers ? { headers: a.headers } : {}) };
      const file = conf.save(cfg);
      return { saved: file, endpoint: a.name, recipe: cfg.endpoints[a.name] };
    }
  },
  {
    name: 'itl_search_case_laws',
    description: 'Search the library for case laws using the configured "search" recipe. Returns the extracted result text, links and tables from the response — nothing is inferred beyond what the site returned.',
    inputSchema: {
      type: 'object',
      properties: {
        query: S.str('Search text, e.g. "section 270AA immunity misreporting".'),
        taxType: S.str('Tax type filter as the site expects it, e.g. "Direct Tax" or "GST".'),
        year: S.str('Year filter.'),
        month: S.str('Month filter.'),
        page: S.num('Page number.'),
        limit: S.num('Max characters of extracted text, default 20000.')
      },
      required: ['query']
    },
    handler: async (a) => {
      const res = await http.runRecipe(cfg, 'search', a);
      return { url: res.url, status: res.status, ...html.summarize(res, { limit: a.limit }) };
    }
  },
  {
    name: 'itl_recent_case_laws',
    description: 'List recent case laws using the configured "recent" recipe (the dashboard filter: tax type, year, month).',
    inputSchema: {
      type: 'object',
      properties: {
        taxType: S.str('e.g. "Direct Tax" or "GST", as the site expects it.'),
        year: S.str('e.g. "2026".'),
        month: S.str('e.g. "September".'),
        page: S.num('Page number.'),
        limit: S.num('Max characters of extracted text, default 20000.')
      }
    },
    handler: async (a) => {
      const res = await http.runRecipe(cfg, 'recent', a);
      return { url: res.url, status: res.status, ...html.summarize(res, { limit: a.limit }) };
    }
  },
  {
    name: 'itl_get_document',
    description: 'Fetch one case law, circular or notification in full. Give either a url/path, or an id when a "document" recipe is configured. Returns the cleaned full text for citation.',
    inputSchema: {
      type: 'object',
      properties: {
        url: S.str('Full URL or path of the document on the site.'),
        id: S.str('Document id, used with the configured "document" recipe.'),
        limit: S.num('Max characters of text to return, default 60000.')
      }
    },
    handler: async (a) => {
      if (!a.url && !a.id) throw new Error('give either "url" or "id"');
      const res = a.url
        ? await http.request(cfg, { method: 'GET', path: a.url })
        : await http.runRecipe(cfg, 'document', a);
      const out = html.summarize(res, { limit: a.limit || 60000, maxLinks: 20, maxTables: 20 });
      return { url: res.url, status: res.status, retrievedAt: new Date().toISOString(), ...out };
    }
  },
  {
    name: 'itl_save_case_law',
    description: 'Save a retrieved case law to the local workspace so it can be cited in a draft. Requires the source URL it was retrieved from, so that every saved authority stays traceable.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: S.str('Case title / citation as printed on the source page.'),
        sourceUrl: S.str('The URL the text was retrieved from.'),
        forum: S.str('Court or tribunal, as printed on the source page.'),
        proposition: S.str('The proposition the case is being kept for.'),
        text: S.str('Full or relevant extracted text of the decision.'),
        tag: S.str('Optional matter tag / file name to group authorities under.')
      },
      required: ['citation', 'sourceUrl', 'text']
    },
    handler: async (a) => {
      const dir = path.join(cfg.workspace, 'case-laws');
      fs.mkdirSync(dir, { recursive: true });
      const base = `${(a.tag ? a.tag + '-' : '')}${a.citation}`.replace(/[^\w.@ -]/g, '_').slice(0, 120);
      const file = path.join(dir, `${base}.md`);
      const body = [
        `# ${a.citation}`, '',
        `- Forum: ${a.forum || '(not stated on source page)'}`,
        `- Source: ${a.sourceUrl}`,
        `- Retrieved: ${new Date().toISOString()}`,
        a.proposition ? `- Proposition: ${a.proposition}` : null,
        '', '## Text', '', a.text
      ].filter(Boolean).join('\n');
      fs.writeFileSync(file, body, 'utf8');
      return { saved: file };
    }
  },
  {
    name: 'itl_list_templates',
    description: 'List the available drafting templates (appeals, replies, applications, writ petition) and the fields each one takes.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ templates: drafts.listTemplates() })
  },
  {
    name: 'itl_draft',
    description: 'Draft a petition, appeal, reply or application from a template. Fields you do not supply are left as [TO BE FILLED: name] and reported back — nothing is invented. Authorities without a sourceUrl are printed with a "NOT VERIFIED" warning.',
    inputSchema: {
      type: 'object',
      properties: {
        template: S.str('Template id from itl_list_templates, e.g. "form35-cita-appeal".'),
        fields: S.obj('Template fields. Strings, or arrays for facts / grounds / prayer / enclosures (rendered as numbered paragraphs).'),
        authorities: {
          type: 'array',
          description: 'Case laws relied upon. Each should carry citation, forum, proposition and the sourceUrl it was retrieved from.',
          items: {
            type: 'object',
            properties: {
              citation: S.str('Case title / citation.'),
              forum: S.str('Court or tribunal.'),
              proposition: S.str('What the case holds.'),
              relevance: S.str('Why it applies to this matter.'),
              sourceUrl: S.str('URL it was retrieved from.'),
              retrievedAt: S.str('Retrieval timestamp.')
            },
            required: ['citation']
          }
        },
        saveAs: S.str('Optional file name to save the draft under workspace/drafts.')
      },
      required: ['template']
    },
    handler: async (a) => {
      const r = drafts.render(a.template, a.fields || {}, a.authorities || null);
      const saved = a.saveAs ? drafts.save(cfg, a.saveAs, r.text) : null;
      return { draft: r.text, missingFields: r.missingFields, unverifiedAuthorities: r.unverifiedAuthorities, saved };
    }
  }
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function result(id, value) { send({ jsonrpc: '2.0', id, result: value }); }
function failure(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return result(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: NAME, version: VERSION }
    });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') return result(id, {});
  if (method === 'tools/list') {
    return result(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (method === 'tools/call') {
    const tool = BY_NAME.get(params && params.name);
    if (!tool) return failure(id, -32602, `unknown tool: ${params && params.name}`);
    try {
      cfg = conf.load();
      const out = await tool.handler((params && params.arguments) || {});
      return result(id, { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] });
    } catch (e) {
      return result(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
    }
  }
  if (id !== undefined) failure(id, -32601, `method not found: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch { return failure(null, -32700, 'parse error'); }
  Promise.resolve(handle(msg)).catch((e) => failure(msg.id, -32603, e.message));
});
rl.on('close', () => process.exit(0));
