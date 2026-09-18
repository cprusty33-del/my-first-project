'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  baseUrl: 'https://www.incometaxlibrary.com',
  auth: { mode: 'cookie', cookieEnv: 'ITL_COOKIE', loginPath: null, loginMethod: 'POST', loginFields: {}, userEnv: 'ITL_USER', passEnv: 'ITL_PASS' },
  timeoutMs: 45000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) itl-mcp/0.1',
  workspace: './itl-workspace',
  endpoints: { search: null, recent: null, document: null }
};

function configPath() {
  if (process.env.ITL_CONFIG) return path.resolve(process.env.ITL_CONFIG);
  return path.join(__dirname, '..', 'config.json');
}

function load() {
  const p = configPath();
  let file = {};
  let exists = false;
  try {
    file = JSON.parse(fs.readFileSync(p, 'utf8'));
    exists = true;
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`config ${p} is not valid JSON: ${e.message}`);
  }
  const cfg = {
    ...DEFAULTS,
    ...file,
    auth: { ...DEFAULTS.auth, ...(file.auth || {}) },
    endpoints: { ...DEFAULTS.endpoints, ...(file.endpoints || {}) }
  };
  cfg._path = p;
  cfg._exists = exists;
  cfg.workspace = path.resolve(path.dirname(p), cfg.workspace);
  return cfg;
}

function save(cfg) {
  const out = { ...cfg };
  delete out._path; delete out._exists;
  fs.writeFileSync(cfg._path, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return cfg._path;
}

// Replaces {name} placeholders. Unknown placeholders are left untouched so the
// caller can see exactly what was not supplied.
function fill(template, vars) {
  if (template === null || template === undefined) return template;
  if (typeof template === 'string') {
    return template.replace(/\{(\w+)\}/g, (m, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m);
  }
  if (Array.isArray(template)) return template.map((t) => fill(t, vars));
  if (typeof template === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(template)) o[fill(k, vars)] = fill(v, vars);
    return o;
  }
  return template;
}

// Drops query/body entries whose value still carries an unfilled {placeholder}.
function pruneUnfilled(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /\{\w+\}/.test(v)) continue;
    o[k] = v;
  }
  return o;
}

module.exports = { load, save, fill, pruneUnfilled, configPath, DEFAULTS };
