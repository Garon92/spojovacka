# Spojovačka

Malá browser hra ve stylu **match‑3**: **prohazuješ dva sousední** tvary a pokud vznikne **vodorovná nebo svislá řada** (min 3), provede se to (jinak se tah vrátí).

## Ovládání

- **Přetáhni dílek** na **sousední** (nahoru/dolů/vlevo/vpravo) → dílky se **prohodí**.
- Pokud po prohození **nevznikne řada 3+**, tah se **automaticky vrátí**.
- **Skóre** se počítá **za každý zničený tvar** (včetně výbuchů).
- **Nová hra**: tlačítko *Nová hra* nahoře.

## Power-upy

- **4 v řadě** → **🚀 raketa**
  - Aktivace: **klik** na raketu, nebo **táhni o 1 políčko vedle** (výbuch se přesune).
  - Efekt: výbuch ve tvaru **“+”** (v rámci 3×3; střed + 4 sousedi).
- **5+ v řadě** → **💣 bomba**
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



