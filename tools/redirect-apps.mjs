// Gera /<slug>/index.html de redirecionamento para os apps que saíram deste site (agora só de jogos).
// GitHub Pages não faz 301: usamos meta refresh 0 + rel=canonical + link visível (o Google trata como redirecionamento).
// Uso: npm run build   (lê apps-redirects.json; também tira os apps do sitemap.xml)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(readFileSync(join(ROOT, 'apps-redirects.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RESERVED = new Set(['city-of-crime', 'ember-ninja', 'kiri', 'mx-rush-offroad', 'neon-vanguard', 'tools', 'node_modules']);

for (const { slug, name } of CFG.apps) {
  if (RESERVED.has(slug)) throw new Error(`${slug}: pasta de jogo`);
  const url = `${CFG.target.replace(/\/$/, '')}/${slug}/`;
  const dir = join(ROOT, slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} mudou de endereço</title>
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${url}">
<script>location.replace(${JSON.stringify(url)} + location.hash);</script>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 16px;color:#1f2a37}a{color:#0f766e}</style>
</head>
<body>
<p>O ${esc(name)} agora fica no site da nextechia:</p>
<p><a href="${url}">${url.replace(/^https:\/\//, '')}</a></p>
</body>
</html>
`);
  console.log(`  ✓ /${slug}/ → ${url}`);
}

// sitemap.xml: só as páginas deste site (os endereços redirecionados saem)
const sm = join(ROOT, 'sitemap.xml');
if (existsSync(sm)) {
  const gone = new Set(CFG.apps.map((a) => a.slug));
  const xml = readFileSync(sm, 'utf8').replace(/\s*<url>\s*<loc>https:\/\/luzbilliardsgames\.github\.io\/([^/<]+)\/<\/loc>[\s\S]*?<\/url>/g, (m, s) => (gone.has(s) ? '' : m));
  writeFileSync(sm, xml);
}
console.log(`ok: ${CFG.apps.length} redirecionamentos`);
