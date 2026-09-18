#!/usr/bin/env node
'use strict';
/* CLI: node bin/discover.js [--write] [--seed /path ...] [--query word] */
const conf = require('../src/config');
const http = require('../src/http');
const { discover } = require('../src/discover');

const argv = process.argv.slice(2);
const seeds = [];
let write = false;
let sampleQuery;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--write') write = true;
  else if (argv[i] === '--seed') seeds.push(argv[++i]);
  else if (argv[i] === '--query') sampleQuery = argv[++i];
}

const cfg = conf.load();
http.seedJar(cfg);
if (!cfg._exists) {
  console.error(`No config at ${cfg._path}. Run: npm run setup`);
  process.exit(1);
}
discover(cfg, { seeds, sampleQuery, write }).then((r) => {
  console.log(JSON.stringify(r, null, 2));
  if (r.ok && !write && Object.keys(r.chosen).length) console.log('\nRe-run with --write to save these recipes into config.json.');
  process.exit(r.ok ? 0 : 2);
}).catch((e) => { console.error('discovery failed:', e.message); process.exit(1); });
