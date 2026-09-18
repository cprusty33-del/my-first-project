#!/usr/bin/env node
'use strict';
/* CLI: creates config.json from config.example.json if absent, then reports what is still needed. */
const fs = require('fs');
const path = require('path');
const conf = require('../src/config');

const target = conf.configPath();
const example = path.join(__dirname, '..', 'config.example.json');
if (fs.existsSync(target)) console.log(`config already present: ${target}`);
else { fs.copyFileSync(example, target); console.log(`created ${target} from config.example.json`); }

const cfg = conf.load();
const cookie = cfg.auth.cookieEnv && process.env[cfg.auth.cookieEnv];
console.log(`baseUrl: ${cfg.baseUrl}`);
console.log(`${cfg.auth.cookieEnv}: ${cookie ? 'set' : 'NOT SET — copy the Cookie header from a logged-in browser session'}`);
const ep = cfg.endpoints || {};
console.log(`endpoints: ${['search', 'recent', 'document'].map((k) => `${k}=${ep[k] ? 'configured' : 'missing'}`).join(', ')}`);
if (!ep.search || !ep.document) console.log('\nNext: npm run discover -- --write   (learns the real requests from the site itself)');
