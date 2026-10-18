# luzbilliardsgames.github.io

Site do estúdio Luz Billiards Games no GitHub Pages: <https://luzbilliardsgames.github.io>

- **Jogos**: `index.html` (home), `styles.css`, `script.js` e as páginas `city-of-crime/`, `ember-ninja/`, `kiri/`,
  `mx-rush-offroad/`, `neon-vanguard/` são editadas à mão. O gerador não mexe nelas.
- **Apps**: as páginas `/<slug>/` (ex.: `/cravei/`, `/ritmo/`) são **geradas** a partir de `apps.json` e das fichas
  da loja que ficam em `C:\Dev\SubscriptionApps`.

## Gerar as páginas dos apps

Requisitos: Node 20+ e a pasta `C:\Dev\SubscriptionApps` (ou outra, via variável `SUBAPPS_DIR`).

```
npm install          # só na primeira vez (instala o sharp, usado para gerar as imagens .webp)
npm run build        # gera /<slug>/, a seção de apps da home e o sitemap.xml
npm run check        # o mesmo, e confere se as URLs de privacidade/termos respondem 200
git add -A && git commit -m "Apps: ..." && git push   # o GitHub Pages publica em ~1 minuto
```

Para cada app, o gerador lê:

| Dado | Origem |
|---|---|
| título, descrição curta e longa, recursos, planos, privacidade, avisos | `C:\Dev\SubscriptionApps\_aab\<pasta>-listing.json` |
| pacote (`com.luzbilliardsgames.<slug>`) e nome | `C:\Dev\SubscriptionApps\<pasta>\app.json` |
| ícone, feature graphic e até 6 screenshots | `C:\Dev\SubscriptionApps\<pasta>\store\graphics\` |

As imagens viram `.webp` (≤ 200 KB cada) em `/<slug>/img/`. Telas de preço/paywall (`*plano*`, `*pro*`,
`*paywall*`) ficam de fora para o site não mostrar preço desatualizado; dá para escolher as telas com
`"screenshots": ["screenshots/01-x.png", ...]` (caminhos relativos a `store/graphics`).

## apps.json

```json
{ "slug": "ritmo", "dir": "ritmo-corrida", "status": "teste", "legalSlug": "ritmo", "category": "HealthApplication" }
```

- `slug`: final do pacote Android (o build confere com o `app.json`). Vira a URL `/<slug>/` e o link da Play.
- `dir`: pasta do app em `C:\Dev\SubscriptionApps`.
- `status`:
  - `"producao"` → botão **Baixar na Google Play** e card na seção **Nossos apps** da home;
  - `"teste"` → em teste fechado: página com “Em breve na Google Play”, **fora da home**;
  - `"em-breve"` → ainda não está na Play: página com “Em breve”, fora da home.
- `legalSlug`: pasta do app no site legal (`https://luz-apps-legal.forja3d-web.workers.dev/<legalSlug>/privacidade`
  e `/termos`). Alguns diferem do pacote (ex.: Luna → `luna`, Salah → `salah`).
- Opcionais: `name`, `category` (schema.org), `accent` (cor), `site` (site próprio), `web` (versão web),
  `screenshots`, `faq` (`[["pergunta", "resposta"], ...]`), `listing` / `graphics` (caminhos relativos a
  `C:\Dev\SubscriptionApps` que substituem a ficha `_aab/<pasta>-listing.json` e `store/graphics`), `package` (pacote
  final, quando o `app.json` ainda não o tem; o `app.json` deixa de ser lido), `legalBase` (URL base própria de
  `/privacidade` e `/termos`, no lugar do site legal), `arquivado: true` (pula o app: a pasta do código
  está só no Google Drive; restaure a pasta e remova a flag para gerar a página).

**Cravei OAB (`craveioab`)** usa `listing`/`graphics`/`package`/`legalBase` provisórios apontando para o site do app
(`C:\Dev\SubscriptionApps\_sites\cravei-oab\brand`), porque a pasta `cravei-oab` ainda é a cópia do Cravei Concursos.
Quando o app tiver ficha em `_aab` e `store/graphics` próprios, apague esses quatro campos.

**Quando um app sair da Play (produção):** mude o `status` dele para `"producao"`, rode `npm run build` e faça o push.
Antes, confira que `https://play.google.com/store/apps/details?id=com.luzbilliardsgames.<slug>` abre sem login.

**App novo:** acrescente a linha em `apps.json`, rode `npm run check` e faça o push.

## Como a home é atualizada

O gerador só escreve entre os marcadores `<!-- APPS:NAV:START/END -->` (link “Apps” no menu) e
`<!-- APPS:HOME:START/END -->` (seção de cards) do `index.html`. Sem app em produção, os dois ficam vazios e a home
fica igual à dos jogos. O `sitemap.xml` mantém as URLs dos jogos e acrescenta as páginas dos apps.
