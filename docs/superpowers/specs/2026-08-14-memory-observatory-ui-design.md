# Memória-obszervatórium — UI design (addendum)

**Dátum:** 2026-08-14 · **Státusz:** approved (vizuális brainstorm, mockup-validált)
**Alap-spec:** [`2026-08-11-memory-observatory-design.md`](2026-08-11-memory-observatory-design.md) (funkcionális design — változatlan)
**Mockup:** [`2026-08-14-memory-observatory-ui-mockup.html`](2026-08-14-memory-observatory-ui-mockup.html) (mind a 4 nézet, jóváhagyott állapot)
**Terv:** [`../plans/2026-08-13-memory-observatory.md`](../plans/2026-08-13-memory-observatory.md) — a Task 3/5/7 komponens-kódja ehhez a designhoz igazítva.

## 1. Szín-rendszer — a réteg-érés skála

Az egész tab vizuális gerince: **az adat lefelé „érik"**, és minden réteg saját színt visel.
Kizárólag meglévő tokenekből (új CSS-token tilos); a wash-hátterek `color-mix`-szel készülnek.

| Réteg | Jelentés | Accent | Wash-háttér |
|---|---|---|---|
| **L0 · Nyers adat** | mért napok | `var(--text-tertiary)` (homok/semleges) | `var(--surface-glass)` |
| **L1 · Epizodikus napló** | összefoglalók + vektorok | `var(--lav-deep)` | `var(--wash-lav)` |
| **L2 · Ítélet-inbox** | ítéletre váró minták/jelöltek | `var(--warning)` (amber) | `color-mix(in srgb, var(--warning) 10%, transparent)` |
| **L3 · Tartós tudás** | megerősített tények | `var(--success)` (sage) | `color-mix(in srgb, var(--success) 10%, transparent)` |

A nézetek a saját rétegük színét viselik: a Napló lav (L1 felülete), az Audit tény-része
sage-hangsúlyú (L3 tartalma), a Kereső lav (a vektor-rétegben keres). Az adatviz (token-oszlopok)
a `--dv-*` sávból színez (ADR 0018 D5): bemenet `--dv-lav`, kimenet `--dv-sage`.

## 2. Áttekintés — „Érés-oszlop"

Teljes szélességű réteg-kártyák, köztük áramlás-konnektorok. Kártya-anatómia (`MemoryLayerCard`):

- wash-tónusú háttér + **4px bal accent-csík** a réteg színében;
- fejléc-sor: színes `L{n} · {név}` eyebrow, jobbra `utoljára: {dátum}` (ha van);
- **nagy display-szám** (`var(--ff-display)`, ~28px): `47/60 nap` · `38 nap` · `6 minta` · `14 tény`;
- al-statisztika chip-sor (`38 nap-vektor`, `112 chat-vektor`, `2 függő tényjelölt`, `31× megerősítés`, `12 a promptban`…);
- koppintható kártyák `np-press`-szel: L1 → Napló szegmens, L2 → `/insights` (Minták), L3 → `/insights/knowledge`.

**Konnektor** (`FlowConnector`): pulzáló szaggatott függőleges vonal a **következő réteg színében**
(oda folyik az adat) + mono cron-chip: `02:20 · napi összefoglaló` → `02:40 · minta-felismerés` →
`vas 03:00 · hipotézis + tudás-promóció`. Animáció: `stroke-dashoffset` menetelés
(`memory-flow` keyframe), `prefers-reduced-motion: reduce` alatt kikapcsol. Az oszlop alján
Motor-link („Miért nem lát még mintát a motor? →").

## 3. Napló — „Memoir-oszlop"

- Hónap-eyebrow elválasztók (`2026. augusztus`), date-desc.
- Teljes **memoir-kártyák**: `card memoir-card` + lav radial-glow dekor a jobb felső sarokban
  (a MemoirPage idiómája), lav dátum-eyebrow (`augusztus 12., szerda`), 14px/1.65 narratíva.
- **Embed-pötty** a kártya sarkában: `var(--success)` = vektorizálva, `var(--text-tertiary)` = még nincs
  (aria-label: `vektorizálva` / `még nincs vektor`).
- Üres állapot: GhostState — „Az első éjszakai összefoglaló még nem készült el — a napló éjjelente, magától íródik."
- A Keresőből érkező fókusz-nap kártyája lav keretet kap + scrollIntoView.

## 4. Kereső — gazdag találati kártya

Lusta keresés (gomb/submit indít, gépelésre nem tüzel). Találati kártya-anatómia (`SimilarDayCard`):

- balra **egyezés-gyűrű** (52px ScoreRing-jellegű SVG): a similarity %-a a közepén, alatta `EGYEZÉS`
  felirat; színe rangsor szerint halványuló lav (első: `--lav-deep`, továbbiak: `--lav`);
- jobbra: lav dátum-eyebrow + `{N} napja` kor-sor + **similarity-sáv** (`bar`/`bar-fill`);
- **memoir-tipográfiás kivonat** (12px/1.6, max ~300 karakter — a szerver vágja);
- alul a **pontszám-matek chipsor**: `egyezés 0.81` × `frissesség 0.96` = `végső 0.78` —
  a frissesség- és végső-chip színe a frissesség-szorzó szerint: ≥0.9 → `--success`, alatta
  `--warning` (a decay-sztori színnel mesélve); a frissesség kliens-oldalon számolt
  (`finalScore / similarity`);
- jobb alsó sarok: `Napló →` — koppintás a Napló szegmensre vált, a nap kártyájára fókuszál.
- Üres találat: „Nincs elég hasonló nap a memóriában." · degraded: „A memória-kereső most nem elérhető."

## 5. Audit — költség-hero + forrás-csoportok

Sorrend és tagolás:

1. **Költség-hero** (lav-wash kártya): `LLM-használat · 30 nap` eyebrow + **nagy display költség**
   (`$0.125`; `—` ha nincs ár); alatta a `TokenColumns` halmozott napi oszlopok
   (bemenet `--dv-lav` alul, kimenet `--dv-sage` felül) + jelmagyarázat-sor:
   `{calls} hívás · bemenet {in} · kimenet {out}`. Kikapcsolt audit-lognál a hero helyén őszinte
   kártya: „Az LLM-hívás audit-napló ki van kapcsolva — nincs mit auditálni."
2. **Forrás-csoportok** — a tények forrás szerint, vonalas szekció-fejléccel
   (`eyebrow + darabszám-chip + elválasztó vonal`):
   `Chatből tanulta` (lav) → `Mintából promótálva` (sage) → `Kézzel rögzítve` (semleges).
   Üres csoport nem jelenik meg.
3. **Tény-sor** (`FactProvenanceRow`): kategória-szín accent-csík (a `factCategoryColor` idióma),
   jól olvasható tény-szöveg (13px, 500-as súly), alatta `×N megerősítve` chip +
   `utoljára: {dátum}` / „még nem erősítette meg újra"; minta-eredetnél `⧉ minta: {cím}` chip
   (sage).

## 6. Mozgás

- Konnektor: `memory-flow` dash-menetelés (1.6s linear infinite).
- Kártya-belépés: a meglévő `np-anim` stagger használható a réteg-kártyákon.
- Minden animáció `prefers-reduced-motion: reduce` alatt kikapcsol (a prototype.css konvenciója).

## 7. Elvetett irányok (feljegyzés)

- Áttekintés: „Gerinc-sín" (bal idővonal-sín) és „Obszervatórium-hero + 2×2 rács" (sötét égbolt-hero) —
  a teljes szélességű érés-oszlop győzött (a színes felület dominál, jobban skálázódik al-statisztikákkal).
- Napló: „Dátum-sín" és „Kivonat-sorok" — a teljes memoir-élmény győzött; a skálázódást a Kereső oldja.
- Kereső/Audit: a külön variánsok helyett mindkettőnél a kombinált, gazdag változat lett a végleges.
