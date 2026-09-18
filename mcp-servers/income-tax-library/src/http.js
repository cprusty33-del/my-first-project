'use strict';
const { fill, pruneUnfilled } = require('./config');

// One cookie jar for the life of the server process, seeded from the
// configured cookie env var and updated by any Set-Cookie we receive.
const jar = new Map();

function seedJar(cfg) {
  const raw = cfg.auth && cfg.auth.cookieEnv ? process.env[cfg.auth.cookieEnv] : null;
  if (!raw) return;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
}

function absorbSetCookie(res) {
  const list = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  for (const c of list) {
    const first = c.split(';')[0];
    const i = first.indexOf('=');
    if (i > 0) jar.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function cookieNames() {
  return [...jar.keys()];
}

function absolute(cfg, target) {
  if (/^https?:\/\//i.test(target)) return new URL(target);
  return new URL(target.startsWith('/') ? target : `/${target}`, cfg.baseUrl);
}

function sameSite(cfg, url) {
  try {
    return new URL(cfg.baseUrl).host === url.host;
  } catch { return false; }
}

async function request(cfg, opts) {
  const { method = 'GET', path: target = '/', query = null, body = null, headers = {}, form = null } = opts;
  const url = absolute(cfg, target);
  if (!sameSite(cfg, url)) throw new Error(`refusing to call ${url.host}: only ${new URL(cfg.baseUrl).host} is allowed by config.baseUrl`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));

  const h = {
    'User-Agent': cfg.userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    ...headers
  };
  const ck = cookieHeader();
  if (ck) h['Cookie'] = ck;

  let payload;
  if (form) {
    payload = new URLSearchParams(form).toString();
    h['Content-Type'] = h['Content-Type'] || 'application/x-www-form-urlencoded';
  } else if (body !== null && body !== undefined) {
    payload = typeof body === 'string' ? body : JSON.stringify(body);
    h['Content-Type'] = h['Content-Type'] || 'application/json';
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
  let res;
  try {
    res = await fetch(url, { method, headers: h, body: payload, signal: ac.signal, redirect: 'follow' });
  } catch (e) {
    throw new Error(`request to ${url.href} failed: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
  absorbSetCookie(res);
  const text = await res.text();
  return {
    url: res.url || url.href,
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get('content-type') || '',
    body: text
  };
}

// Runs a named recipe from config.endpoints with {placeholders} filled from vars.
async function runRecipe(cfg, name, vars) {
  const recipe = cfg.endpoints ? cfg.endpoints[name] : null;
  if (!recipe) {
    throw new Error(`endpoint "${name}" is not configured. Discover the real request with itl_probe, then add it under endpoints.${name} in ${cfg._path} (see README > Discovering endpoints). No endpoint is assumed by this server.`);
  }
  const r = fill(recipe, vars);
  return request(cfg, {
    method: r.method || 'GET',
    path: r.path || '/',
    query: pruneUnfilled(r.query),
    form: r.form ? pruneUnfilled(r.form) : null,
    body: r.body || null,
    headers: r.headers || {}
  });
}

async function login(cfg) {
  const a = cfg.auth || {};
  if (a.mode !== 'login' || !a.loginPath) throw new Error('auth.mode is not "login" or auth.loginPath is not set in config');
  const user = process.env[a.userEnv || 'ITL_USER'];
  const pass = process.env[a.passEnv || 'ITL_PASS'];
  if (!user || !pass) throw new Error(`set ${a.userEnv || 'ITL_USER'} and ${a.passEnv || 'ITL_PASS'} in the environment`);
  const fields = {};
  for (const [k, v] of Object.entries(a.loginFields || {})) fields[k] = v === '{user}' ? user : v === '{pass}' ? pass : v;
  if (!Object.keys(fields).length) throw new Error('auth.loginFields must name the form fields, e.g. {"email":"{user}","password":"{pass}"}');
  return request(cfg, { method: a.loginMethod || 'POST', path: a.loginPath, form: fields });
}

module.exports = { request, runRecipe, login, seedJar, cookieNames, cookieHeader };
