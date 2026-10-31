// Páginas de cada jogo da vitrine (SEO): /<slug>/index.html para todo jogo listado em index.html que tem screenshot.
// Fonte única: os cards de index.html (nome, gênero, descrição, imagem, trailer, link da Play). Também:
//   - link de cada card para a página do jogo (título do card);
//   - JSON-LD Organization, WebSite e ItemList na home;
//   - títulos com até 60 caracteres nas páginas de jogo (inclusive as feitas à mão);
//   - sitemap.xml com todas as páginas e lastmod da última alteração no git.
// Uso: npm run build   (roda redirect-apps.mjs e depois este script). Não cria páginas para jogos sem screenshot.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://luzbilliardsgames.github.io';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, max) => (s.length <= max ? s : s.slice(0, s.lastIndexOf(' ', max - 1)).replace(/[,;:\s]+$/, '') + '…');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

// Política de privacidade já publicada (rodapé de index.html)
const PRIVACY = {
  'sinuca-master-3d': 'https://doc-hosting.flycricket.io/sinuca-master-3d-privacy-policy/33688913-0b16-4e91-99ca-ba30ee9e9258/privacy',
  'ultimate-8-ball-billiards': 'https://doc-hosting.flycricket.io/ultimate-8-ball-billiards-privacy-policy/1c4ba880-1d77-41d1-b004-0b7c9b9086c9/privacy',
  'damas-master-3d': 'https://doc-hosting.flycricket.io/damas-master-3d-privacy-policy/0d378c5c-eff7-42fa-bdfe-403b160283f9/privacy',
  'neon-vanguard': 'neon-vanguard/privacy.html',
  'ember-ninja': 'https://ember-ninja-game.web.app/privacy',
  'kiri': 'https://kiri-arvoria.web.app',
  'reservatorio-de-doces': 'reservatorio-de-doces/privacy.html',
};

let index = readFileSync(join(ROOT, 'index.html'), 'utf8');

// ---------- cards de index.html ----------
const cards = [...index.matchAll(/<article class="game-card">([\s\S]*?)<\/article>/g)].map((m) => {
  const c = m[1];
  const img = c.match(/<img src="((?:game-[^"]+|[a-z-]+\/img\/[^"]+)\.jpg)" alt="([^"]*)"/);
  const play = c.match(/href="(https:\/\/play\.google\.com\/[^"]+)"/)?.[1] ?? null;
  const badge = c.match(/<span class="badge[^"]*">([^<]+)<\/span>/)?.[1].trim() ?? '';
  const video = c.match(/data-video="([^"]+)" data-poster="([^"]+)" data-title="([^"]*)"/);
  const info = c.match(/<div class="game-info">([\s\S]*?)<\/div>\s*<\/article>?/)?.[1] ?? c;
  const name = decode(info.match(/<h3>([\s\S]*?)<\/h3>/)[1].replace(/<[^>]+>/g, ''));
  const genre = decode(info.match(/<p class="game-genre">([^<]+)<\/p>/)[1]);
  const desc = decode(info.match(/<\/h3>\s*<p>([\s\S]*?)<\/p>/)[1]);
  const slug = img ? (img[1].startsWith('game-') ? img[1].replace(/^game-/, '').replace(/\.jpg$/, '').replace(/_/g, '-') : img[1].split('/')[0]) : null;
  return { name, genre, desc, slug, img: img ? { src: img[1], alt: decode(img[2]) } : null, play, badge, testing: /Em teste/.test(badge),
    available: /Dispon/.test(badge), video: video ? { src: video[1], poster: video[2], title: decode(video[3]) } : null };
});
if (cards.length < 15) throw new Error(`cards encontrados: ${cards.length}`);

// ---------- páginas ----------
const titleFor = (g) => [`${g.name} — jogo Android | Luz Billiards Games`, `${g.name} — jogo para Android`, `${g.name} | Luz Billiards Games`, g.name]
  .find((t) => t.length <= 60);
const STATUS_TXT = (g) => (g.play ? 'Baixe grátis no Google Play.' : g.testing ? 'Em teste fechado no Google Play: entre no grupo de testadores.' : 'Em breve no Google Play.');
const lastmodOf = (file) => {
  try { const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim(); if (d) return d; } catch {}
  return new Date().toISOString().slice(0, 10);
};

// páginas geradas levam o marcador GEN; as feitas à mão não têm e não são reescritas (só o título é ajustado)
const GEN = '<!-- gerado por tools/build-games.mjs: edite o card em index.html, não esta página -->';
const isGen = (slug) => existsSync(join(ROOT, slug, 'index.html')) && readFileSync(join(ROOT, slug, 'index.html'), 'utf8').includes(GEN);
const pages = cards.filter((g) => g.slug && g.img && (!existsSync(join(ROOT, g.slug, 'index.html')) || isGen(g.slug)));
const handMade = cards.filter((g) => g.slug && existsSync(join(ROOT, g.slug, 'index.html')) && !isGen(g.slug));
const pageGames = [...pages, ...handMade];

const header = `<header class="topbar">
        <div class="container topbar-inner">
            <a href="../" class="brand">
                <img src="../logo.jpg" alt="" width="36" height="36">
                <span>Luz Billiards Games</span>
            </a>
            <nav class="nav" aria-label="Principal">
                <a href="../#jogos">Jogos</a>
                <a href="../#testador">Testadores</a>
                <a href="../#contato">Contato</a>
            </nav>
        </div>
    </header>`;

const pageHtml = (g) => {
  const url = `${BASE}/${g.slug}/`;
  const title = titleFor(g);
  const status = STATUS_TXT(g);
  const description = `${clip(g.desc, 160 - status.length - 1)} ${status}`;
  const img = g.img ? `${BASE}/${g.img.src}` : `${BASE}/og-image.jpg`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'VideoGame', name: g.name, description: g.desc, url, inLanguage: 'pt-BR',
      genre: g.genre.split(/\s*·\s*/), gamePlatform: 'Android', operatingSystem: 'Android', applicationCategory: 'GameApplication',
      image: img, author: { '@id': `${BASE}/#org` }, publisher: { '@id': `${BASE}/#org` },
      ...(g.play ? { installUrl: g.play, offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url: g.play } } : {}) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Jogos', item: `${BASE}/#jogos` },
      { '@type': 'ListItem', position: 3, name: g.name, item: url },
    ] },
  ];
  const others = pageGames.filter((o) => o.slug !== g.slug).slice(0, 4);
  const mediaImg = g.img ? `<img class="game-page-shot" src="../${g.img.src}" alt="${esc(g.img.alt)}" width="1024" height="500" fetchpriority="high">` : '';
  const trailer = g.video ? `<h2>Trailer</h2>
        <video controls playsinline preload="none" poster="../${g.video.poster}" src="../${g.video.src}" style="width:100%;border-radius:12px;background:#000" aria-label="${esc(g.video.title)}">Seu navegador não reproduz vídeo. <a href="../${g.video.src}">Baixar o trailer</a>.</video>` : '';
  const cta = g.play
    ? `<a class="btn-store" href="${esc(g.play)}" target="_blank" rel="noopener">Baixe grátis no Google Play</a>`
    : g.testing
      ? `<a class="btn-tester" href="../#testador">Seja testador</a>`
      : '';
  const privacy = PRIVACY[g.slug] ? `<p class="game-privacy">Política de privacidade: <a href="${esc(PRIVACY[g.slug])}" rel="noopener">${esc(g.name)}</a></p>` : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    ${GEN}
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="theme-color" content="#0a0e1f">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:site_name" content="Luz Billiards Games">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${img}">
    <meta property="og:image:alt" content="${esc(g.img ? g.img.alt : g.name)}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
    <link rel="stylesheet" href="../styles.css">
    <style>
        .game-page { max-width: 900px; margin: 0 auto; padding: 24px 16px 64px; }
        .game-page .crumbs { font-size: 14px; opacity: .85; margin: 8px 0 16px; }
        .game-page .crumbs a { color: inherit; }
        .game-page h1 { margin: 0 0 6px; }
        .game-page .game-page-shot { width: 100%; height: auto; border-radius: 12px; margin: 8px 0 20px; }
        .game-page .cta { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }
        .game-page .game-page-others { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; padding: 0; list-style: none; }
        .game-page .game-page-others a { display: block; padding: 12px; border-radius: 10px; background: rgba(255,255,255,.06); color: inherit; text-decoration: none; }
    </style>
    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
    ${header}
    <main class="game-page">
        <nav class="crumbs" aria-label="Trilha"><a href="../">Início</a> › <a href="../#jogos">Jogos</a> › ${esc(g.name)}</nav>
        <h1>${esc(g.name)}</h1>
        <p class="game-genre">${esc(g.genre)} · ${esc(g.badge)}</p>
        ${mediaImg}
        <p>${esc(g.desc)}</p>
        <div class="cta">${cta}<a class="btn-ghost" href="../#jogos">Ver todos os jogos</a></div>
        ${trailer}
        ${privacy}
        <h2>Outros jogos da Luz</h2>
        <ul class="game-page-others">${others.map((o) => `<li><a href="../${o.slug}/"><strong>${esc(o.name)}</strong><br><small>${esc(o.genre)}</small></a></li>`).join('')}</ul>
    </main>
    <footer class="footer">
        <div class="container footer-bottom">
            <p>&copy; ${new Date().getFullYear()} Luz Billiards Games. <a href="../#contato">Contato</a>. Google Play é uma marca da Google LLC.</p>
        </div>
    </footer>
</body>
</html>
`;
};

for (const g of pages) {
  mkdirSync(join(ROOT, g.slug), { recursive: true });
  writeFileSync(join(ROOT, g.slug, 'index.html'), pageHtml(g));
}

// ---------- títulos das páginas feitas à mão (até 60 caracteres) ----------
for (const g of handMade) {
  const file = join(ROOT, g.slug, 'index.html');
  let html = readFileSync(file, 'utf8');
  const t = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const d = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  if (t.length > 60) html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(titleFor(g))}</title>`);
  if (d.length > 160) html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(clip(d, 160))}"`);
  if (html !== readFileSync(file, 'utf8')) { writeFileSync(file, html); console.log(`  ajustado: ${g.slug} (título ${t.length}, descrição ${d.length})`); }
}

// ---------- index.html: link do título de cada card para a página do jogo + JSON-LD ----------
const withPage = pageGames.filter((g) => existsSync(join(ROOT, g.slug, 'index.html')));
for (const g of withPage) {
  const re = new RegExp(`(<h3>)(${g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:/g, ':')})(</h3>)`);
  const alreadyLinked = new RegExp(`<h3><a href="${g.slug}/">`).test(index);
  if (!alreadyLinked) {
    const hit = index.match(re);
    if (hit) index = index.replace(re, `<h3><a href="${g.slug}/">$2</a></h3>`);
    else console.warn(`  ! card não encontrado para ${g.name}`);
  }
}
const siteLd = [
  { '@context': 'https://schema.org', '@type': 'Organization', '@id': `${BASE}/#org`, name: 'Luz Billiards Games', url: `${BASE}/`,
    logo: `${BASE}/logo.jpg`, email: 'luzbilliardsgames@gmail.com', description: 'Estúdio brasileiro de jogos para Android: sinuca, 8 ball, ação, terror, tabuleiro e puzzle.' },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Luz Billiards Games', url: `${BASE}/`, inLanguage: 'pt-BR', publisher: { '@id': `${BASE}/#org` } },
  { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Jogos da Luz Billiards Games', numberOfItems: withPage.length,
    itemListElement: withPage.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.name, url: `${BASE}/${g.slug}/` })) },
];
const LD_MARK = '<!-- ld:site -->';
const ldBlock = `${LD_MARK}\n${siteLd.map((j) => `    <script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}\n`;
index = index.includes(LD_MARK)
  ? index.replace(new RegExp(`${LD_MARK}[\\s\\S]*?(?=</head>)`), ldBlock)
  : index.replace('</head>', `    ${ldBlock}</head>`);
// descrição da home dentro de 160 caracteres
index = index.replace(/<meta name="description" content="([^"]*)"/, (m, d) => {
  const dd = decode(d);
  if (dd.length <= 160) return m;
  const short = 'Estúdio brasileiro de jogos para Android: sinuca, 8 ball, ação, terror, tabuleiro e puzzle. Jogue Sinuca Master 3D, Ultimate 8 Ball, City of Crime e Damas Master 3D.';
  return `<meta name="description" content="${esc(clip(short, 160))}"`;
});
writeFileSync(join(ROOT, 'index.html'), index);

// ---------- sitemap.xml ----------
const urls = [{ loc: `${BASE}/`, file: 'index.html' }, ...withPage.map((g) => ({ loc: `${BASE}/${g.slug}/`, file: `${g.slug}/index.html` }))];
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastmodOf(u.file)}</lastmod>\n  </url>`).join('\n')}
</urlset>
`);

console.log(`ok: ${withPage.length} páginas de jogo (${pages.length} novas, ${handMade.length} feitas à mão); sem página: ${cards.filter((g) => !withPage.includes(g)).map((g) => g.name).join(', ') || 'nenhum'}`);
