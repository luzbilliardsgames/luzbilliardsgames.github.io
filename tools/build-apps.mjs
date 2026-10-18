// Gera as páginas dos apps (/<slug>/), a seção de apps da home e o sitemap.xml
// a partir de apps.json + fichas da loja (_aab/<dir>-listing.json) + gráficos (<dir>/store/graphics).
//
// Uso: npm run build            (gera tudo)
//      npm run build -- --check (também confere se os links de privacidade/termos respondem 200)
//
// O que NÃO é tocado: as páginas dos jogos, styles.css, script.js e o conteúdo da home fora dos
// marcadores <!-- APPS:...:START --> / <!-- APPS:...:END -->.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(readFileSync(join(ROOT, 'apps.json'), 'utf8'));
const SITE = CFG.siteUrl.replace(/\/$/, '');
const SRC = process.env.SUBAPPS_DIR || CFG.sourceRoot;
const CHECK = process.argv.includes('--check');
const TODAY = new Date().toISOString().slice(0, 10);
const RESERVED = new Set(['apps-assets', 'tools', 'node_modules', 'city-of-crime', 'ember-ninja', 'kiri', 'mx-rush-offroad', 'neon-vanguard']);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripEmoji = (s) => s.replace(/^[^\p{L}\p{N}"“(]+/u, '').trim();
const isHeading = (line) => {
  const t = stripEmoji(line);
  if (!t || t.length > 60 || /[.:]$/.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return false;
  return letters === letters.toLocaleUpperCase('pt-BR');
};
const titleCase = (s) => {
  const low = s.toLocaleLowerCase('pt-BR');
  return low.charAt(0).toLocaleUpperCase('pt-BR') + low.slice(1);
};
// Siglas que devem continuar em maiúsculas depois do titleCase
const keepUpper = (s) => s.replace(/\b(ia|pro|gps|qr|pdf|cnh|cf|amoled|oab|fgv)\b/gi, (m) => m.toUpperCase())
  .replace(/\b(cravei|mindo|ritmo|pitada|muralia|lar|arguição)\b/gi, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());

function parseListing(full) {
  const blocks = full.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out = { intro: [], features: [], plans: [], privacy: null, notes: [] };
  let seenHeading = false;
  for (let b of blocks) {
    let lines = b.split('\n').map((l) => l.trim()).filter((l) => !/^(Dúvidas|Privacidade: https?:|Termos: https?:)/i.test(l));
    if (!lines.length) continue;
    const head = lines.length > 1 && isHeading(lines[0]) ? stripEmoji(lines[0]) : null;
    const body = head ? lines.slice(1) : lines;
    const text = lines.join('\n');
    if (head) seenHeading = true;
    if (/R\$/.test(text) || (head && /^(PLANOS?\b|.*\bGRÁTIS\b|.*\bPRO$|ASSINATURA|PREÇO)/i.test(head)) || /^(GRÁTIS|Plano grátis|[\p{L} ]+ PRO:|[\p{L} ]+ Pro:)/u.test(lines[0])) {
      out.plans.push({ head, lines: body });
    } else if (head && /PRIVACIDADE|PRIVADO/i.test(head)) {
      out.privacy = { head, lines: body };
    } else if (head && /AVISO|IMPORTANTE|ATENÇÃO|NÃO ORIENTAÇÃO|ORIENTAÇÃO MÉDICA/i.test(head)) {
      out.notes.push({ head, lines: body });
    } else if (head) {
      out.features.push({ head: keepUpper(titleCase(head)), lines: body });
    } else if (!seenHeading) {
      out.intro.push(text);
    } else {
      out.notes.push({ head: null, lines: body });
    }
  }
  return out;
}

// Linhas de texto → HTML (listas para "•", "–", "1.")
function linesHtml(lines) {
  let html = '';
  let list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const bullet = raw.match(/^[•\-–]\s*(.*)$/);
    const num = raw.match(/^\d+\.\s+(.*)$/);
    if (bullet || num) {
      const tag = num ? 'ol' : 'ul';
      if (list !== tag) { close(); html += `<${tag}>`; list = tag; }
      html += `<li>${boldPrefix(esc((bullet || num)[1]))}</li>`;
    } else {
      close();
      html += `<p>${boldPrefix(esc(raw))}</p>`;
    }
  }
  close();
  return html;
}
const boldPrefix = (s) => s.replace(/^([\p{L}\p{N} ]{2,28}):\s/u, '<strong>$1:</strong> ');

function findScreenshots(gdir, wanted) {
  if (wanted?.length) return wanted.map((f) => join(gdir, f)).filter(existsSync);
  const shotsDir = join(gdir, 'screenshots');
  let files = [];
  if (existsSync(shotsDir)) files = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).map((f) => join(shotsDir, f));
  if (!files.length) {
    const all = readdirSync(gdir).filter((f) => /^screenshot.*\.(png|jpe?g)$/i.test(f));
    const pt = all.filter((f) => /pt-BR/i.test(f));
    files = (pt.length ? pt : all.filter((f) => !/en-US/i.test(f))).map((f) => join(gdir, f));
  }
  // telas de preço/paywall ficam de fora (o preço pode mudar antes da captura ser refeita)
  files = files.sort().filter((f) => !/(plano|planos|paywall|pro)\.(png|jpe?g)$/i.test(f));
  return files.slice(0, 6);
}

async function toWebp(src, dest, width, quality = 78) {
  let q = quality;
  for (;;) {
    await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toFile(dest);
    if (statSync(dest).size <= 200 * 1024 || q <= 40) return;
    q -= 8;
  }
}

async function accentOf(icon) {
  // média dos pixels mais saturados (o "dominante" puro costuma pegar o fundo escuro do ícone)
  const { data } = await sharp(icon).resize(48, 48).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += 3) {
    const [R, G, B] = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const sat = max ? (max - min) / max : 0;
    if (max > 70) px.push({ R, G, B, s: sat * (max / 255) });
  }
  px.sort((p, q) => q.s - p.s);
  const top = px.slice(0, Math.max(20, Math.floor(px.length * 0.25)));
  let r = top.reduce((t, p) => t + p.R, 0) / top.length;
  let g = top.reduce((t, p) => t + p.G, 0) / top.length;
  let b = top.reduce((t, p) => t + p.B, 0) / top.length;
  if (!top.length || !Number.isFinite(r)) ({ r, g, b } = (await sharp(icon).stats()).dominant);
  // escurece até ter contraste suficiente com texto branco (botões)
  const lum = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = () => 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  while ((1.05) / (L() + 0.05) < 4.6) { r *= 0.9; g *= 0.9; b *= 0.9; }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const playUrl = (pkg) => `https://play.google.com/store/apps/details?id=${pkg}`;
const PLAY_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3.6 2.3c-.3.3-.4.7-.4 1.2v17c0 .5.1.9.4 1.2l9.5-9.7-9.5-9.7Zm10.6 8.6 2.7-2.7-11-6.3c-.3-.2-.7-.3-1-.2l9.3 9.2Zm0 2.2-9.3 9.2c.3.1.7 0 1-.2l11-6.3-2.7-2.7Zm6.1-2.6-2.7-1.5-3 3 3 3 2.7-1.5c.8-.5.8-1.6 0-2Z"/></svg>';

function playButton(app) {
  if (app.status === 'producao') {
    return `<a class="play-btn" href="${playUrl(app.package)}" rel="noopener">${PLAY_SVG}<span><small>Baixar na</small>Google Play</span></a>`;
  }
  const label = app.status === 'teste' ? 'Em teste fechado' : 'Em breve';
  return `<span class="play-btn is-soon" aria-disabled="true">${PLAY_SVG}<span><small>${label}</small>Em breve na Google Play</span></span>`;
}

function faqFor(app, L) {
  const faq = [];
  const free = L.plans.flatMap((p) => p.lines).find((l) => /^(GRÁTIS|Plano grátis|•\s*Grátis)/i.test(l));
  if (free) faq.push([`O ${app.name} é gratuito?`, `Sim, dá para usar de graça. ${free.replace(/^•\s*/, '').replace(/^(GRÁTIS|Plano grátis|Grátis)\s*:?\s*/i, 'No plano grátis: ')} Os recursos extras ficam na assinatura, cobrada pela Google Play.`]);
  if (L.plans.length) faq.push(['Como cancelo a assinatura?', 'A assinatura é feita pela Google Play e renova automaticamente. Para cancelar, abra a Google Play › Pagamentos e assinaturas › Assinaturas, escolha o app e toque em Cancelar. Você continua com acesso até o fim do período já pago.']);
  if (L.privacy) faq.push(['O que acontece com os meus dados?', L.privacy.lines.map((l) => l.replace(/^•\s*/, '')).join(' ').replace(/([^.])$/, '$1.')]);
  if (app.status !== 'producao') faq.push([`Quando o ${app.name} chega à Google Play?`, app.status === 'teste' ? `O ${app.name} está em teste fechado na Google Play e deve ser liberado para todos em breve. Esta página ganha o botão de download no dia do lançamento.` : `O ${app.name} está em fase final de preparação. Esta página ganha o botão de download no dia do lançamento.`]);
  faq.push(['Como falo com o suporte?', `Escreva para ${CFG.supportEmail}. Respondemos em português.`]);
  for (const [q, a] of app.faq || []) faq.push([q, a]);
  return faq;
}

function head({ title, description, url, image, jsonld, accent }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="${accent}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Luz Billiards Games">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1024">
<meta property="og:image:height" content="500">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="stylesheet" href="../apps-assets/apps.css">
<style>:root{--accent:${accent}}</style>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>`;
}

async function buildApp(app) {
  const dir = join(SRC, app.dir);
  // app.listing / app.graphics (relativos a sourceRoot) substituem a ficha e os gráficos da loja — para apps
  // que ainda não têm _aab/<dir>-listing.json nem store/graphics (ex.: em-breve, ficha vinda do site do app).
  const listingPath = app.listing ? join(SRC, app.listing) : join(SRC, '_aab', `${app.dir}-listing.json`);
  const gdir = app.graphics ? join(SRC, app.graphics) : join(dir, 'store', 'graphics');
  if (!existsSync(listingPath) || !existsSync(gdir)) {
    console.warn(`  ! ${app.slug}: ficha ou gráficos ausentes (${app.dir}) — página não gerada`);
    return null;
  }
  // app.package: usado quando o app.json ainda não tem o pacote final (o build não lê o app.json)
  const appJson = app.package ? { name: app.name, android: { package: app.package } } : JSON.parse(readFileSync(join(dir, 'app.json'), 'utf8')).expo;
  const pkg = appJson.android.package;
  const slug = pkg.split('.').pop();
  if (slug !== app.slug) throw new Error(`${app.dir}: slug "${app.slug}" ≠ pacote ${pkg}`);
  if (RESERVED.has(slug)) throw new Error(`${slug}: nome reservado (já existe no site)`);
  const listing = JSON.parse(readFileSync(listingPath, 'utf8'));
  const L = parseListing(listing.full);
  const name = app.name || appJson.name;
  const a = { ...app, name, package: pkg, title: listing.title, short: listing.short };

  const out = join(ROOT, slug);
  rmSync(join(out, 'img'), { recursive: true, force: true });
  mkdirSync(join(out, 'img'), { recursive: true });
  const icon = join(gdir, 'icon-512.png');
  await toWebp(icon, join(out, 'img', 'icon.webp'), 256, 85);
  await sharp(icon).resize(512).png({ compressionLevel: 9, palette: true }).toFile(join(out, 'img', 'icon-512.png'));
  const fg = join(gdir, 'feature-graphic.png');
  if (existsSync(fg)) {
    await toWebp(fg, join(out, 'img', 'destaque.webp'), 1024, 80);
    await sharp(fg).flatten({ background: '#ffffff' }).jpeg({ quality: 80, mozjpeg: true }).toFile(join(out, 'img', 'og.jpg'));
  }
  const shots = findScreenshots(gdir, app.screenshots);
  if (shots.length < 3) console.warn(`  ! ${slug}: só ${shots.length} screenshots`);
  const shotNames = [];
  for (let i = 0; i < shots.length; i++) {
    const n = `tela-${i + 1}.webp`;
    await toWebp(shots[i], join(out, 'img', n), 540, 78);
    shotNames.push(n);
  }
  const accent = app.accent || await accentOf(icon);
  const url = `${SITE}/${slug}/`;
  const legal = app.legalBase || `${CFG.legalBase}/${app.legalSlug || slug}`;
  const faq = faqFor(a, L);
  const statusLabel = { producao: 'Disponível', teste: 'Em teste fechado', 'em-breve': 'Em breve' }[a.status];
  const description = `${listing.short} ${a.status === 'producao' ? 'Baixe grátis na Google Play.' : 'Em breve na Google Play.'}`.slice(0, 158);

  const software = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: listing.title, alternateName: name,
    operatingSystem: 'Android', applicationCategory: app.category || 'LifestyleApplication', description: listing.short,
    url, image: `${url}img/icon-512.png`, inLanguage: 'pt-BR',
    publisher: { '@type': 'Organization', name: 'Luz Billiards Games', url: `${SITE}/` },
    ...(a.status === 'producao' ? { installUrl: playUrl(pkg), offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' } } : {}),
  };
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, ans]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: ans } })) };

  const html = `${head({ title: `${listing.title} — app para Android`, description, url, image: `${url}img/og.jpg`, jsonld: [software, faqLd], accent })}
<body>
<header class="bar"><div class="wrap bar-in">
  <a class="brand" href="../"><img src="../logo.jpg" alt="" width="28" height="28"><span>Luz Billiards Games</span></a>
  <nav aria-label="Nesta página"><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#faq">Dúvidas</a></nav>
</div></header>
<main>
<section class="hero"><div class="wrap hero-in">
  <div class="hero-copy">
    <img class="app-icon" src="img/icon.webp" alt="Ícone do ${esc(name)}" width="96" height="96">
    <p class="status status-${a.status}">${statusLabel}</p>
    <h1>${esc(listing.title)}</h1>
    <p class="lead">${esc(listing.short)}</p>
    <div class="cta">${playButton(a)}${a.site ? `<a class="ghost-btn" href="${a.site}" rel="noopener">Site oficial</a>` : ''}${a.web ? `<a class="ghost-btn" href="${a.web}" rel="noopener">Usar no navegador</a>` : ''}</div>
  </div>
  ${shotNames[0] ? `<div class="hero-phone"><img src="img/${shotNames[0]}" alt="Tela do ${esc(name)}" width="540" height="960" fetchpriority="high"></div>` : ''}
</div></section>

<section class="wrap about">
  <h2>Sobre o ${esc(name)}</h2>
  ${L.intro.map((p) => `<p>${esc(p)}</p>`).join('\n  ')}
</section>

${shotNames.length > 1 ? `<section class="shots" aria-label="Telas do app"><div class="wrap"><h2>Veja por dentro</h2></div>
  <div class="shots-row">${shotNames.map((n, i) => `<img src="img/${n}" alt="Tela ${i + 1} do ${esc(name)}" width="540" height="960" loading="lazy" decoding="async">`).join('')}</div>
</section>` : ''}

<section class="wrap" id="recursos">
  <h2>Recursos</h2>
  <div class="grid">${L.features.map((f) => `<article class="card"><h3>${esc(f.head)}</h3>${linesHtml(f.lines)}</article>`).join('')}</div>
</section>

${L.plans.length ? `<section class="wrap" id="planos">
  <h2>Planos e preços</h2>
  <div class="plans">${L.plans.map((p) => `<div class="plan">${p.head ? `<h3>${esc(keepUpper(titleCase(p.head)))}</h3>` : ''}${linesHtml(p.lines)}</div>`).join('')}</div>
  <p class="fine">Preços da Google Play no Brasil, sujeitos a alteração pela loja. A assinatura renova automaticamente e pode ser cancelada a qualquer momento.</p>
</section>` : ''}

${L.privacy || L.notes.length ? `<section class="wrap notes">
  ${L.privacy ? `<div class="note"><h3>Privacidade</h3>${linesHtml(L.privacy.lines)}</div>` : ''}
  ${L.notes.map((n) => `<div class="note">${n.head ? `<h3>${esc(keepUpper(titleCase(n.head)))}</h3>` : '<h3>Bom saber</h3>'}${linesHtml(n.lines)}</div>`).join('')}
</section>` : ''}

<section class="wrap" id="faq">
  <h2>Perguntas frequentes</h2>
  ${faq.map(([q, ans]) => `<details><summary>${esc(q)}</summary><p>${esc(ans)}</p></details>`).join('\n  ')}
</section>

<section class="wrap final">
  <img src="img/icon.webp" alt="" width="64" height="64" loading="lazy">
  <h2>${esc(name)}</h2>
  <p>${esc(listing.short)}</p>
  ${playButton(a)}
</section>
</main>
<footer class="foot"><div class="wrap foot-in">
  <p><a href="${legal}/privacidade" rel="noopener">Política de privacidade</a> · <a href="${legal}/termos" rel="noopener">Termos de uso</a> · <a href="mailto:${CFG.supportEmail}">${CFG.supportEmail}</a></p>
  <p>© ${new Date().getFullYear()} Luz Billiards Games · <a href="../">Todos os jogos e apps</a> · Google Play é uma marca da Google LLC.</p>
</div></footer>
</body>
</html>
`;
  writeFileSync(join(out, 'index.html'), html);
  if (CHECK) {
    for (const p of ['privacidade', 'termos']) {
      const r = await fetch(`${legal}/${p}`, { redirect: 'follow' });
      if (r.status !== 200) console.warn(`  ! ${slug}: ${legal}/${p} → HTTP ${r.status}`);
    }
  }
  console.log(`  ✓ ${slug} (${a.status}, ${shotNames.length} telas, cor ${accent})`);
  return { ...a, slug, url, accent };
}

function homeSection(apps) {
  const live = apps.filter((a) => a.status === 'producao');
  if (!live.length) return { nav: '', section: '' };
  return {
    nav: '<a href="#apps">Apps</a>',
    section: `<link rel="stylesheet" href="apps-assets/home-apps.css">
        <section class="apps-section" id="apps">
            <div class="container">
                <h2>Nossos apps</h2>
                <p class="section-subtitle">Apps de produtividade, estudo e bem-estar, feitos no Brasil, sem anúncios.</p>
                <div class="apps-grid">
${live.map((a) => `                    <a class="app-card" href="${a.slug}/" style="--accent:${a.accent}">
                        <img src="${a.slug}/img/icon.webp" alt="" width="64" height="64" loading="lazy">
                        <span><strong>${esc(a.title)}</strong><small>${esc(a.short)}</small></span>
                    </a>`).join('\n')}
                </div>
            </div>
        </section>`,
  };
}

function replaceBetween(html, key, content) {
  const re = new RegExp(`(<!-- APPS:${key}:START -->)[\\s\\S]*?(<!-- APPS:${key}:END -->)`);
  if (!re.test(html)) throw new Error(`marcador APPS:${key} não encontrado no index.html`);
  return html.replace(re, `$1${content ? `\n${content}\n` : ''}$2`);
}

function writeSitemap(apps) {
  const path = join(ROOT, 'sitemap.xml');
  const managed = new Set(apps.map((a) => a.url));
  const existing = existsSync(path) ? [...readFileSync(path, 'utf8').matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: m[1].match(/<loc>(.*?)<\/loc>/)[1].trim(), lastmod: (m[1].match(/<lastmod>(.*?)<\/lastmod>/) || [])[1],
  })) : [];
  const keep = existing.filter((u) => !managed.has(u.loc));
  for (const extra of CFG.extraSitemapUrls || []) if (!keep.some((u) => u.loc === extra)) keep.push({ loc: extra, lastmod: TODAY });
  const all = [...keep, ...apps.map((a) => ({ loc: a.url, lastmod: TODAY }))];
  writeFileSync(path, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map((u) => `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`).join('\n')}
</urlset>
`);
}

console.log(`Fonte: ${SRC}`);
const built = [];
for (const app of CFG.apps) {
  if (app.arquivado) { console.log(`  - ${app.slug}: fonte arquivada, pulado`); continue; }
  const r = await buildApp(app);
  if (r) built.push(r);
}
const idxPath = join(ROOT, 'index.html');
let idx = readFileSync(idxPath, 'utf8');
const { nav, section } = homeSection(built);
idx = replaceBetween(idx, 'NAV', nav);
idx = replaceBetween(idx, 'HOME', section);
writeFileSync(idxPath, idx);
writeSitemap(built);
console.log(`ok: ${built.length} páginas de apps, ${built.filter((a) => a.status === 'producao').length} na home`);
