#!/usr/bin/env node
// Serves dist/ over the local network, so the guides and the comparison can be
// opened on a phone on the same WiFi. No dependencies.
//
//   node build/serve.mjs            → http://<your-mac-ip>:8080
//   node build/serve.mjs 3000

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { join, extname, normalize } from 'node:path';

const PORT = Number(process.argv[2]) || 8080;
const ROOT = 'dist';
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json',
                '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const index = files => `<!doctype html><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Relocation OS — local preview</title>
<style>
 body{font:16px/1.6 ui-serif,Georgia,serif;max-width:34rem;margin:3rem auto;padding:0 1.25rem;
      background:#fbfaf8;color:#1c1a17}
 @media(prefers-color-scheme:dark){body{background:#16151a;color:#eceaf0}a{color:#e08a72}}
 h1{font-size:1.5rem} a{color:#8a3324;display:block;padding:.85rem 0;
    border-bottom:1px solid #e3ded6;text-decoration:none;font-weight:600}
 p{color:#5f5a52;font-size:.9rem}
</style>
<h1>Relocation OS — local preview</h1>
<p>Served from <code>dist/</code>. Open these on your phone while it is on the same WiFi.</p>
${files.map(f => `<a href="/${f}">${f.replace(/-/g, ' ').replace(/\.html$/, '')}</a>`).join('\n')}`;

const lanAddress = () => Object.values(networkInterfaces()).flat()
  .find(i => i && i.family === 'IPv4' && !i.internal)?.address ?? 'localhost';

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') {
      const { readdir } = await import('node:fs/promises');
      const files = (await readdir(ROOT)).filter(f => f.endsWith('.html')).sort();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(index(files));
    }
    // Contain every request inside dist/ — this listens on the LAN.
    const path = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if (!path.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    await stat(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
                         'cache-control': 'no-store' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  On this machine   http://localhost:${PORT}`);
  console.log(`  On your phone     http://${lanAddress()}:${PORT}`);
  console.log(`\n  Same WiFi, no VPN. Ctrl-C to stop.\n`);
});
