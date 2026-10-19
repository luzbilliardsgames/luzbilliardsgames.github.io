# luzbilliardsgames.github.io

Site do estúdio Luz Billiards Games no GitHub Pages: <https://luzbilliardsgames.github.io>

- **Jogos**: `index.html` (home), `styles.css`, `script.js` e as páginas `city-of-crime/`, `ember-ninja/`, `kiri/`,
  `mx-rush-offroad/`, `neon-vanguard/` são editadas à mão. O script de redirecionamento não mexe nelas.
- **Apps**: saíram deste site. Desde 2026-10 os apps ficam em **https://nextechia.com.br** (site do desenvolvedor,
  projeto `C:\Dev\SubscriptionApps\_sites\nextechia`). As pastas `/<slug>/` antigas dos apps (`cravei`, `craveioab`,
  `muralia`, `pitada`, `lar`, `mindo`, `ritmo`) viraram redirecionamentos para `https://nextechia.com.br/<slug>/`.

## Redirecionamentos dos apps

GitHub Pages não faz 301; cada `/<slug>/index.html` usa meta refresh 0 + `rel=canonical` + link visível (o Google trata
como redirecionamento). Lista em `apps-redirects.json`.

```
npm run build        # regera /<slug>/index.html dos redirecionamentos e tira esses endereços do sitemap.xml
git add -A && git commit -m "..." && git push
```

O antigo gerador de páginas de apps (`tools/build-apps.mjs`, `apps.json`, `apps-assets/`) foi removido; o histórico está no git.
