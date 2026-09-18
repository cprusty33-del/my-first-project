'use strict';
/* End-to-end check: runs the MCP server over stdio against a local stub site. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itl-mcp-test-'));

const site = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/search') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(`<html><head><title>Results for ${u.searchParams.get('q')}</title></head><body>
      <table><tr><th>Heading</th></tr><tr><td><a href="/case/99">ABC Ltd v. ACIT - penalty u/s 270A</a></td></tr></table></body></html>`);
  }
  if (u.pathname === '/case/99') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<html><head><title>ABC Ltd v. ACIT</title></head><body><p>Held: the penalty was deleted.</p></body></html>');
  }
  res.writeHead(404, { 'content-type': 'text/html' });
  res.end('<html><body>not found</body></html>');
});

function rpc(child, pending) {
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const cb = pending.get(msg.id);
      if (cb) { pending.delete(msg.id); cb(msg); }
    }
  });
}

(async () => {
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const port = site.address().port;
  const cfgPath = path.join(tmp, 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify({
    baseUrl: `http://127.0.0.1:${port}`,
    workspace: path.join(tmp, 'ws'),
    endpoints: {
      search: { method: 'GET', path: '/search', query: { q: '{query}', page: '{page}' } },
      document: { method: 'GET', path: '/case/{id}' }
    }
  }, null, 2));

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, ITL_CONFIG: cfgPath },
    stdio: ['pipe', 'pipe', 'inherit']
  });
  const pending = new Map();
  rpc(child, pending);
  let id = 0;
  const call = (method, params) => new Promise((resolve) => {
    const myId = ++id;
    pending.set(myId, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n');
  });
  const tool = async (name, args) => {
    const r = await call('tools/call', { name, arguments: args || {} });
    const text = r.result.content[0].text;
    try { return { isError: r.result.isError, data: JSON.parse(text) }; }
    catch { return { isError: r.result.isError, data: text }; }
  };

  const init = await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'selftest', version: '0' } });
  assert.strictEqual(init.result.serverInfo.name, 'income-tax-library');

  const list = await call('tools/list', {});
  const names = list.result.tools.map((t) => t.name);
  assert.ok(names.includes('itl_search_case_laws') && names.includes('itl_draft'), 'tools listed');

  const status = await tool('itl_status');
  assert.strictEqual(status.data.endpointsConfigured.search, true);
  assert.strictEqual(status.data.endpointsConfigured.recent, false);

  const search = await tool('itl_search_case_laws', { query: 'penalty 270A' });
  assert.strictEqual(search.data.status, 200);
  assert.ok(search.data.text.includes('ABC Ltd v. ACIT'), 'search text extracted');
  assert.ok(search.data.links.some((l) => l.url.endsWith('/case/99')), 'result link extracted');

  const recent = await tool('itl_recent_case_laws', { year: '2026' });
  assert.ok(recent.isError && /not configured/.test(recent.data), 'unconfigured endpoint fails loudly');

  const doc = await tool('itl_get_document', { id: '99' });
  assert.ok(doc.data.text.includes('penalty was deleted'), 'document fetched');

  const probeOther = await tool('itl_probe', { path: 'https://example.com/' });
  assert.ok(probeOther.isError && /refusing to call/.test(probeOther.data), 'off-site request refused');

  const setEp = await tool('itl_set_endpoint', { name: 'recent', path: '/search', query: { q: '{taxType}', year: '{year}' } });
  assert.ok(setEp.data.saved === cfgPath);
  const recent2 = await tool('itl_recent_case_laws', { taxType: 'Direct Tax', year: '2026' });
  assert.strictEqual(recent2.data.status, 200, 'recipe saved and reloaded');

  const saved = await tool('itl_save_case_law', { citation: 'ABC Ltd v. ACIT', sourceUrl: `http://127.0.0.1:${port}/case/99`, text: 'Held: the penalty was deleted.' });
  assert.ok(fs.existsSync(saved.data.saved), 'case law saved');

  const draft = await tool('itl_draft', {
    template: 'form35-cita-appeal',
    fields: { appellant: 'ABC Ltd', pan: 'AAACA1111A', grounds: ['The AO erred in levying penalty.'] },
    authorities: [{ citation: 'ABC Ltd v. ACIT', sourceUrl: `http://127.0.0.1:${port}/case/99`, proposition: 'Penalty deleted.' }],
    saveAs: 'abc-ltd-cita-appeal'
  });
  assert.ok(draft.data.draft.includes('The AO erred in levying penalty.'), 'grounds rendered');
  assert.ok(draft.data.draft.includes('[TO BE FILLED: assessmentYear]'), 'missing fields flagged, not invented');
  assert.strictEqual(draft.data.unverifiedAuthorities, 0);
  assert.ok(fs.existsSync(draft.data.saved), 'draft saved');

  const badTemplate = await tool('itl_draft', { template: 'no-such' });
  assert.ok(badTemplate.isError, 'unknown template errors');

  child.stdin.end();
  site.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('selftest: all checks passed');
})().catch((e) => { console.error('selftest FAILED:', e); process.exit(1); });
