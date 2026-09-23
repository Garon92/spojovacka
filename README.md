# Spojovačka

Barevná hra typu **match-3** pro celou rodinu: prohazuj sousední dílky, skládej řady tří a víc stejných,
vyráběj rakety, bomby, duhy a motýly a plň úkoly ve **40 úrovních** ve čtyřech světech.
Součást rozcestníku [garon92.github.io](https://garon92.github.io/) (sdílený design kit g92).

## Režimy

- **Úrovně** – mapa se 40 úrovněmi (Rozkvetlá louka, Tajemný les, Zamrzlé jezero, Hvězdná noc). Každá úroveň má
  úkoly a omezený počet tahů, za body 1–3 hvězdy. Zbylé tahy se na konci promění v rakety (bonus).
- **Pohoda** – pro nejmenší: bez tahů, bez času, bez prohry. Na výběr 4, 5 nebo 6 barev.
- **Na čas** – 90 sekund, co nejvíc bodů, každý odpálený speciál přidá sekundu; rekord pro každou obtížnost.
- **Zvířátka** – kolečko se zvířátkem z původní hry (běží tím rychleji, čím víc bodů máš). Za mince 🪙 z her si koupíš
  další zvířátka (myška, potkan, křeček, pejsek, kočička, zajíček, dinosaurus, liška).

## Pravidla

- Přetáhni dílek na souseda (nebo klepni na dva sousedy za sebou). Tři a víc stejných v řadě zmizí,
  nad nimi se dílky sesypou a doplní nové – vznikají řetězy s násobičem bodů.
- Každá barva má vlastní tvar (srdíčko, kolečko, hvězdička, trojúhelník, kosočtverec, čtvereček) – hratelné i pro barvoslepé.

| tvar spojení | speciál | co udělá |
|---|---|---|
| 4 v řadě | 🚀 raketa | vyčistí celý řádek nebo sloupec |
| L nebo T | 💣 bomba | výbuch kolem sebe (kruh o průměru 5) |
| 5 v řadě | 🌈 duha | prohozená s dílkem odstraní všechny dílky té barvy |
| čtverec 2×2 | 🦋 motýl | vyčistí „+“ kolem sebe a odletí k překážce/úkolu |

Speciál se odpálí klepnutím nebo prohozením (stojí tah). **Komba** (prohoď dva speciály): raketa+raketa = kříž,
raketa+bomba = 3 řádky a 3 sloupce, bomba+bomba = obří výbuch, duha+speciál = všechny dílky té barvy se promění,
duha+duha = celá deska, motýl+raketa/bomba = motýl speciál odnese.

**Překážky a úkoly:** led (1–2 vrstvy), bedny (1–3 zásahy), řetězy, díry v desce, kuřátka, která je potřeba dostat dolů,
sbírání barev, body, odpálení speciálů.

**Ovládání:** myš, dotyk i klávesnice (šipky = kurzor, Enter/mezerník = výběr, šipka = prohození, H = nápověda,
P/Esc = pauza). Když chvíli nehraješ, hra sama ukáže tah. Když na desce žádný tah není, dílky se samy zamíchají.

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5177/spojovacka/
npm run test       # Vitest – herní logika (shody, speciály, gravitace, míchání, cíle…)
npm run typecheck
npm run build      # dist/ (PWA, funguje offline)
npm run balance    # simulace (silný bot + „malý hráč“) → počty tahů a hranice hvězd (src/core/balance.json)
```

Stack: Vite + TypeScript (strict), bez frameworku, canvas 2D, `vite-plugin-pwa`, Vitest.

- `src/core/` – čistá herní logika bez DOM (deska, shody, speciály, gravitace, míchání, cíle, úrovně, bot).
  `playMove()` vrací seznam kroků, které renderer jen přehrává.
- `src/render/` – canvas renderer, sprity dílků, částice, efekty, kolečko se zvířátkem.
- `src/input/` – tažení, klepání, klávesnice. `src/ui/` – obrazovky a HUD. `src/audio/` – syntetizované zvuky.
- `src/kit/` – sdílený g92 kit (vendorovaná kopie z `menu/kit`, needitovat – `bash ../menu/kit/sync.sh spojovacka`).
- `scripts/e2e-*.mjs` – headless kontrola (screenshoty, skutečné tahy myší/klávesnicí, dohrání úrovně).

Postup se ukládá do `localStorage` (`g92:spojovacka:*`); starý záznam z původní verze (`spojovacka:v1` –
koupená zvířátka, vzhled dílků) se automaticky převede.

## Nasazení

GitHub Actions (`.github/workflows/deploy.yml`): typecheck → testy → build → GitHub Pages.
V nastavení repozitáře musí být **Settings → Pages → Source: GitHub Actions**.
