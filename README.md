# Spojovačka

Malá browser hra ve stylu “spojování tahem” (connect): táhneš myší přes stejné barvy, mažeš tvary, sbíráš skóre a vytváříš power-upy.

## Ovládání

- **Táhni myší** přes **stejné barvy** (4-směrově sousední) a **pusť**.
- **Minimum je 3** spojené tvary.
- **Skóre** se počítá **za každý zničený tvar** (včetně výbuchů).
- **Nová hra**: tlačítko *Nová hra* nahoře.

## Power-upy

- **4 spojené** → **🚀 raketa**
  - Aktivace: **klik** na raketu, nebo **táhni o 1 políčko vedle** (výbuch se přesune).
  - Efekt: výbuch ve tvaru **“+”** (v rámci 3×3; střed + 4 sousedi).
- **5+ spojených** → **💣 bomba**
  - Aktivace: **klik** na bombu.
  - Efekt: výbuch **kruhem** o **průměru 5** (radius 2).

## Vzhled tvarů

V HUDu pod herní plochou jde přepínat:

- **Kuličky** (default)
- **Dino**
- **Diamanty**

## Kolečko se zvířetem + skiny

Vpravo je “kolečko”, ve kterém běhá zvíře:

- **Rychlost roste se skóre** (asymptoticky, 100% nejde dosáhnout).
- Skins (např. **potkan/pes/dinosaurus**) lze **koupit za skóre**.
- **Nákup skina resetuje skóre** (a tím i rychlost).

## Zvuky

Hra má jednoduché zvukové efekty (WebAudio) a dají se vypnout přepínačem **Zvuk**.

## GitHub Pages

Repo je statické (jen `index.html` + JS/CSS). Pro GitHub Pages:

1. **Settings → Pages**
2. **Source**: *Deploy from a branch*
3. **Branch**: `main`, **Folder**: `/(root)`



