# Mezo Clay Asset Package

Draft v1 (2026-08-26) for the UI redesign (`mezo-88jw`). Source of truth for the clay graphic
language decided in the mockup rounds — see `docs/design_2.0/2026-08-26-ui-ia-redesign-handoff.md` §10.

## Files

| File | Contents |
|---|---|
| `logo-orb.svg` | The Orb — standalone logo mark (app icon, chat avatar, coach marker) |
| `clay-icons.svg` | Sprite: 33 `<symbol>` icons, ids `i-*`, all `viewBox="0 0 100 100"` |
| `clay-spots.svg` | Sprite: 22 `<symbol>` spot illustrations, ids `s-*` (incl. the 8 persona orb variants `s-orb-doki` … `s-orb-szkeptikus` — the Karakter profiling team, mezo-1gim.13: the `s-orb` clay recipe recolored per domain + a dashed inner-ring motif at per-persona rotation) |

Browsable catalog artifact: https://claude.ai/code/artifact/ *(see bd issue notes for current link)*.

## Usage

Inline the sprite into the DOM (Vite: `?raw` import injected once, or a build-time include),
then reference symbols:

```html
<svg width="24" height="24"><use href="#i-nap"/></svg>
```

External-file `use` (`href="clay-icons.svg#i-nap"`) also works in modern browsers but blocks
styling and is cache-quirky — prefer DOM inlining. Icons are fixed-color art (not
`currentColor`): inactive/tab-bar muting is done with CSS `filter: grayscale(1)
brightness(1.04) opacity(.48)`.

## Inventory

### Icons (`i-*`)

| id | HU name | Primary use |
|---|---|---|
| i-nap | Nap | tab bar (spine) |
| i-edzes | Edzés | tab bar, session cards |
| i-fuel | Fuel | tab bar, meal rows |
| i-mezo | Mezo | tab bar (chat), companion chrome |
| i-polc | Polc | shelf/overflow nav |
| i-viz | Víz | water ring/tile |
| i-alvas | Alvás | sleep tile, night rows |
| i-eletjel | Életjel | needs rings section |
| i-minta | Minta | insight/pattern digests |
| i-naplo | Napló | journal entries |
| i-cel | Cél | goal rows |
| i-stack | Stack | supplement doses |
| i-suly | Súly | weight log |
| i-sport | Sport | volleyball sessions |
| i-futas | Futás | running sessions |
| i-meso | Mesociklus | meso arc/overview |
| i-emberek | Emberek | people/mentions |
| i-tudas | Tudás | knowledge facts/graph |
| i-ertesites | Értesítés | notification bell |
| i-growth | Growth | XP/skills/quests |
| i-erme | Érme | coins |
| i-lang | Láng | streak |
| i-beallitas | Beállítás | settings entries |
| i-mikrofon | Mikrofon | voice input |
| i-kamra | Kamra | pantry |
| i-recept | Recept | recipes |
| i-checkin | Check-in | check-in slots |
| i-hajnal | Hajnal | daypart switcher (Reggel) |
| i-level | Levél | Mezo messages tile (with unread badge) |
| i-rend | Rend | Életjel "Rend" need (zen stones) |
| i-video | Videó | exercise demo video chip (play button) |
| i-idozito | Időzítő | rest timer (pihenő) bar + timer surfaces |
| i-kihivas | Kihívás | workout challenges ("A mai küldetések" carousel) |

### Spots (`s-*`)

| id | HU name | Primary use |
|---|---|---|
| s-reggel | Reggel | morning daypart hero |
| s-este | Este | evening daypart hero |
| s-viz | Víz | water hero/sheet |
| s-energia | Energia | fuel/keret hero |
| s-edzes | Edzés | session prep hero |
| s-medal | Medál | PR/medal celebration |
| s-orb | Mezo orb · éber | brand, chat header |
| s-orb-ejszaka | Orb · éjszaka | night mode, wind-down |
| s-orb-figyel | Orb · figyel | chat listening/voice state |
| s-orb-unnepel | Orb · ünnepel | celebrations, level-up |
| s-piheno | Pihenőnap | rest-day card |
| s-napzaras | Napzárás | ritual entry/handoff |
| s-hajtas | Hajtás | growth/quests hero, empty states |
| s-hegycel | Hegycél | goal hero |

## Mini-clay rules

1. **Silhouette-first** — the shape must read at 20px in one flat color; gradient and light come after.
2. **One gradient + one highlight** per piece — more layers turn to mud at small sizes.
3. **Ground shadow only ≥32px** (spots yes, tab-bar icons no).
4. **Inactive = muted** — in the tab bar only the active icon is colored (CSS filter above).
5. **Light always from top-left** (radial center ~35%/28%) — this is what makes it a set, not a collection.

## Extending the package

Page-specific assets (Napzárás stage scenes, empty-state illustrations, further orb states)
are added here as screens get designed — never authored ad-hoc inside a page. Keep gradient id
prefixes unique (`ig-` icons, `sg-` spots, `logo-`) so sprites can be co-inlined.
