'use strict';
/**
 * Endpoint discovery. Nothing here guesses a URL: every candidate comes from a
 * form or a link found in the site's own HTML, and each proposal is verified by
 * actually issuing the request before it is offered.
 */
const { request } = require('./http');
const { save } = require('./config');
const html = require('./html');

const DEFAULT_SEEDS = ['/', '/dashboard'];

const ROLE_HINTS = {
  query: [/^(q|s|query|search|keyword|kw|text|term)/i, /search/i, /keyword/i],
  taxType: [/tax.?type/i, /^type$/i, /category/i, /act$/i, /module/i],
  year: [/year/i, /^yr$/i],
  month: [/month/i, /^mon$/i],
  page: [/^page$/i, /^p$/i, /pageno/i]
};

function roleFor(name) {
  for (const [role, pats] of Object.entries(ROLE_HINTS)) {
    if (pats.some((p) => p.test(name))) return role;
  }
  return null;
}

function pathOf(cfg, url) {
  try {
    const u = new URL(url, cfg.baseUrl);
    return u.pathname + (u.search || '');
  } catch { return url; }
}

// /case-law/12345 -> /case-law/{id};  /judgment/abc-ltd-v-acit -> /judgment/{id}
function patternOf(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  const idLike = /^\d+$/.test(last) || /^[0-9a-f]{8,}$/i.test(last) || (last.includes('-') && last.length > 12) || /\d{3,}/.test(last);
  if (!idLike) return null;
  return '/' + [...parts.slice(0, -1), '{id}'].join('/');
}

async function collect(cfg, seeds) {
  const pages = [];
  for (const seed of seeds) {
    let res;
    try { res = await request(cfg, { method: 'GET', path: seed }); }
    catch (e) { pages.push({ seed, error: e.message }); continue; }
    pages.push({
      seed,
      url: res.url,
      status: res.status,
      loginWall: html.looksLikeLogin(res.body),
      title: html.title(res.body),
      forms: html.forms(res.body, res.url),
      links: html.links(res.body, res.url)
    });
  }
  return pages;
}

function proposeFromForms(cfg, pages) {
  const search = [];
  const recent = [];
  const push = (list, entry) => {
    const key = JSON.stringify(entry.recipe);
    if (list.some((e) => JSON.stringify(e.recipe) === key)) return;
    list.push(JSON.parse(JSON.stringify(entry)));
  };
  for (const p of pages) {
    for (const f of p.forms || []) {
      if (f.fields.some((x) => x.type === 'password')) continue;
      const mapped = {};
      const roles = [];
      for (const field of f.fields) {
        if (['submit', 'button', 'image', 'reset'].includes(field.type)) continue;
        const role = roleFor(field.name);
        if (role) { mapped[field.name] = `{${role}}`; roles.push(role); }
        else if (field.value) mapped[field.name] = field.value;
      }
      if (!Object.keys(mapped).length) continue;
      const recipe = {
        method: f.method || 'GET',
        path: pathOf(cfg, f.action || p.url).split('?')[0],
        ...(f.method === 'POST' ? { form: mapped } : { query: mapped })
      };
      const entry = { recipe, roles: [...new Set(roles)], foundOn: p.seed, formId: f.id || f.name || '(unnamed form)', fields: f.fields.map((x) => x.name) };
      // A form can serve as both a search and a filter candidate, and the same
      // form recurs on several seed pages — give each list its own copy, and
      // keep only one copy per distinct request.
      if (roles.includes('query')) push(search, entry);
      if (roles.includes('year') || roles.includes('month') || roles.includes('taxType')) push(recent, entry);
    }
  }
  return { search, recent };
}

function proposeDocument(cfg, pages) {
  const counts = new Map();
  for (const p of pages) {
    for (const l of p.links || []) {
      const pattern = patternOf(pathOf(cfg, l.url).split('?')[0]);
      if (!pattern) continue;
      const e = counts.get(pattern) || { pattern, count: 0, samples: [] };
      e.count += 1;
      if (e.samples.length < 3) e.samples.push({ text: l.text.slice(0, 120), url: l.url });
      counts.set(pattern, e);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5)
    .map((c) => ({ recipe: { method: 'GET', path: c.pattern }, seenTimes: c.count, samples: c.samples }));
}

async function verifySearch(cfg, entry, sampleQuery) {
  const vars = { query: sampleQuery, taxType: '', year: '', month: '', page: '' };
  const r = JSON.parse(JSON.stringify(entry.recipe));
  const bag = r.query || r.form || {};
  for (const [k, v] of Object.entries(bag)) {
    const m = /^\{(\w+)\}$/.exec(String(v));
    if (m) {
      if (vars[m[1]]) bag[k] = vars[m[1]];
      else delete bag[k];
    }
  }
  try {
    const res = await request(cfg, { method: r.method, path: r.path, query: r.query, form: r.form });
    const text = html.toText(res.body);
    return {
      status: res.status,
      url: res.url,
      loginWall: html.looksLikeLogin(res.body),
      mentionsQuery: new RegExp(sampleQuery.split(/\s+/)[0], 'i').test(text),
      resultLinks: html.links(res.body, res.url).filter((l) => patternOf(pathOf(cfg, l.url).split('?')[0])).length,
      textPreview: text.slice(0, 400)
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function verifyDocument(cfg, candidate) {
  const sample = candidate.samples && candidate.samples[0];
  if (!sample) return { skipped: 'no sample link' };
  try {
    const res = await request(cfg, { method: 'GET', path: sample.url });
    const text = html.toText(res.body);
    return { status: res.status, url: res.url, loginWall: html.looksLikeLogin(res.body), textLength: text.length, titleOnPage: html.title(res.body), textPreview: text.slice(0, 400) };
  } catch (e) { return { error: e.message }; }
}

async function discover(cfg, opts = {}) {
  const seeds = opts.seeds && opts.seeds.length ? opts.seeds : DEFAULT_SEEDS;
  const sampleQuery = opts.sampleQuery || 'penalty';
  const pages = await collect(cfg, seeds);

  const reachable = pages.filter((p) => !p.error && p.status && p.status < 400);
  if (!reachable.length) {
    return { ok: false, pages, advice: 'No seed page could be fetched. Check baseUrl, network access and the session cookie.' };
  }
  if (reachable.every((p) => p.loginWall)) {
    return { ok: false, pages: reachable.map(({ seed, url, status, title, loginWall }) => ({ seed, url, status, title, loginWall })), advice: 'Every seed page is a login wall: the session is not authenticated. Refresh ITL_COOKIE from a logged-in browser, or configure auth.mode="login" and call itl_login.' };
  }

  const { search, recent } = proposeFromForms(cfg, pages);
  const documents = proposeDocument(cfg, pages);

  for (const s of search) s.verification = await verifySearch(cfg, s, sampleQuery);
  for (const r of recent) r.verification = { note: 'not auto-verified: filter values must match the site\'s own option values' };
  for (const d of documents) d.verification = await verifyDocument(cfg, d);

  const bestSearch = search.filter((s) => s.verification && s.verification.status === 200 && !s.verification.loginWall)
    .sort((a, b) => (b.verification.resultLinks || 0) - (a.verification.resultLinks || 0))[0] || null;
  const bestDocument = documents.filter((d) => d.verification && d.verification.status === 200 && !d.verification.loginWall)
    .sort((a, b) => (b.verification.textLength || 0) - (a.verification.textLength || 0))[0] || null;
  const bestRecent = recent[0] || null;

  const chosen = {
    ...(bestSearch ? { search: bestSearch.recipe } : {}),
    ...(bestRecent ? { recent: bestRecent.recipe } : {}),
    ...(bestDocument ? { document: bestDocument.recipe } : {})
  };

  let written = null;
  if (opts.write && Object.keys(chosen).length) {
    cfg.endpoints = { ...(cfg.endpoints || {}), ...chosen };
    written = save(cfg);
  }

  return {
    ok: true,
    seedsFetched: pages.map(({ seed, url, status, title, loginWall, error }) => ({ seed, url, status, title, loginWall, error })),
    candidates: { search, recent, documents },
    chosen,
    written,
    unresolved: ['search', 'recent', 'document'].filter((k) => !chosen[k]),
    advice: 'Recipes not chosen must be captured by hand: run the action in the browser with DevTools > Network open, then record it with itl_set_endpoint.'
  };
}

module.exports = { discover, patternOf, roleFor, DEFAULT_SEEDS };
