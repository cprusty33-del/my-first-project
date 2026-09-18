'use strict';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };

function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(\w+);/g, (m, n) => (n in ENTITIES ? ENTITIES[n] : m));
}

function stripNoise(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
}

function toText(html) {
  let s = stripNoise(html);
  s = s.replace(/<\/(p|div|tr|li|h[1-6]|section|article|table)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(td|th)>/gi, '\t');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decode(s);
  s = s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function title(html) {
  const m = stripNoise(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).trim() : '';
}

// Links, with their visible text — the practical way to pick a case law out of
// a listing page without knowing the site's markup in advance.
function links(html, baseUrl) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(stripNoise(html)))) {
    const attrs = m[1];
    const href = (attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i) || [])[1];
    if (!href || /^(javascript:|#|mailto:|tel:)/i.test(href)) continue;
    const text = toText(m[2]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    let url = href;
    if (baseUrl) { try { url = new URL(href, baseUrl).href; } catch { /* keep raw */ } }
    out.push({ text, url });
  }
  return out;
}

function tables(html) {
  const out = [];
  const tRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let t;
  while ((t = tRe.exec(stripNoise(html)))) {
    const rows = [];
    const rRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let r;
    while ((r = rRe.exec(t[1]))) {
      const cells = [];
      const cRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let c;
      while ((c = cRe.exec(r[1]))) cells.push(toText(c[2]).replace(/\s+/g, ' ').trim());
      if (cells.length) rows.push(cells);
    }
    if (rows.length) out.push(rows);
  }
  return out;
}

// Turns any response into something a model can read, without guessing schema.
function summarize(res, opts = {}) {
  const limit = opts.limit || 20000;
  const isJson = /json/i.test(res.contentType) || /^\s*[[{]/.test(res.body);
  if (isJson) {
    try {
      const data = JSON.parse(res.body);
      return { kind: 'json', data, text: JSON.stringify(data, null, 2).slice(0, limit) };
    } catch { /* fall through to html/text */ }
  }
  const text = toText(res.body);
  return {
    kind: /html/i.test(res.contentType) ? 'html' : 'text',
    title: title(res.body),
    text: text.slice(0, limit),
    truncated: text.length > limit,
    links: links(res.body, res.url).slice(0, opts.maxLinks || 80),
    tables: tables(res.body).slice(0, opts.maxTables || 10)
  };
}

module.exports = { toText, title, links, tables, summarize, decode };
