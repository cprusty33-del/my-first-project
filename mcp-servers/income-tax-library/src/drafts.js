'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

function listTemplates() {
  return fs.readdirSync(TEMPLATE_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const body = fs.readFileSync(path.join(TEMPLATE_DIR, f), 'utf8');
      const fields = [...new Set([...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
      return { id: f.replace(/\.md$/, ''), heading: (body.split('\n')[0] || '').replace(/^#+\s*/, ''), fields };
    });
}

function readTemplate(id) {
  const file = path.join(TEMPLATE_DIR, `${path.basename(id)}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`unknown template "${id}". Available: ${listTemplates().map((t) => t.id).join(', ')}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function numbered(items, label) {
  return items.map((it, i) => `${i + 1}. ${label ? `${label} ` : ''}${String(it).trim()}`).join('\n\n');
}

function formatValue(key, value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    if (key === 'grounds') return numbered(value);
    if (key === 'facts') return numbered(value);
    if (key === 'enclosures') return value.map((v, i) => `${i + 1}. ${String(v).trim()}`).join('\n');
    if (key === 'prayer') return numbered(value);
    return value.map((v) => `- ${String(v).trim()}`).join('\n');
  }
  return String(value).trim();
}

// Every authority must carry the source URL it was retrieved from. Anything
// without one is printed with an explicit warning instead of being dressed up
// as a verified citation.
function formatAuthorities(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const lines = [];
  list.forEach((a, i) => {
    const citation = (a.citation || a.title || '').trim();
    if (!citation) throw new Error(`authority #${i + 1} has no "citation"`);
    const forum = a.forum ? ` (${a.forum})` : '';
    lines.push(`${i + 1}. **${citation}**${forum}`);
    if (a.proposition) lines.push(`   - Held / proposition: ${String(a.proposition).trim()}`);
    if (a.relevance) lines.push(`   - Relevance: ${String(a.relevance).trim()}`);
    if (a.sourceUrl) lines.push(`   - Source: ${a.sourceUrl}${a.retrievedAt ? ` (retrieved ${a.retrievedAt})` : ''}`);
    else lines.push('   - ⚠ NOT VERIFIED: no source URL from Income Tax Library. Verify this citation before filing.');
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

function render(templateId, fields = {}, authorities = null) {
  const body = readTemplate(templateId);
  const values = {};
  for (const [k, v] of Object.entries(fields)) {
    const f = formatValue(k, v);
    if (f !== null) values[k] = f;
  }
  const auth = formatAuthorities(authorities);
  if (auth !== null) values.authorities = auth;
  else if (!('authorities' in values)) values.authorities = '_No judicial precedent is relied upon in this draft._';

  const missing = new Set();
  const out = body.replace(/\{(\w+)\}/g, (m, k) => {
    if (Object.prototype.hasOwnProperty.call(values, k)) return values[k];
    missing.add(k);
    return `[TO BE FILLED: ${k}]`;
  });
  const unverified = Array.isArray(authorities) ? authorities.filter((a) => !a.sourceUrl).length : 0;
  return { text: out, missingFields: [...missing], unverifiedAuthorities: unverified };
}

function save(cfg, name, text) {
  const dir = path.join(cfg.workspace, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const safe = String(name).replace(/[^\w.@ -]/g, '_').slice(0, 120) || 'draft';
  const file = path.join(dir, safe.endsWith('.md') ? safe : `${safe}.md`);
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

module.exports = { listTemplates, readTemplate, render, save, TEMPLATE_DIR };
