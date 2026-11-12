---
cim: AI és memória
szint: Fő szekció
terulet: AI és memória
allapot: Részben kész
hol: [Háttérrendszer, AI]
szulo:
szakasz: [S3, B0, B2, B3, B8]
osszefoglalo: A háttérben dolgozó mesterséges intelligencia — ami emlékszik rád, éjjel átnézi az adataidat, szöveget ír Boopnak, és soha nem változtat semmin a koppintásod nélkül.
---

## Mit csinál
Ez a szekció azt írja le, ami Boop „feje” mögött történik:
- **Az emlékezet** — Boop megjegyzi a beszélgetéseket, naplót, összefoglalókat, és vissza tudja keresni őket.
- **Tények rólad** — rövid, megerősített állítások, amik minden beszélgetésbe bekerülnek.
- **Beágyazás** — ami az emlékeket tartalom szerint kereshetővé teszi (B0-ban OpenAI-ra költözött).
- **Éjszakai konzílium** — a háttérben futó szakértői átnézés (Boopban közvetlenül nem látszik).
- **Honnan jönnek a javaslatok** — a javaslatkártyák és a „miért?” háttere (a kártyák felülete: Ma szekció).
- **Minták és hipotézisek** — ebből lesznek a „Boop észrevette” kártyák (felülete: Ma szekció).
- **A reggeli összefoglaló szövege** (a felülete: Ma › Reggeli ítélet) és **Boop egymondatos sorai** (kitöltés után,
  esti záráskor).
- **Melyik AI mire** — modellek és szolgáltatók.
- **Költségkeret és naplózás** — hogy az AI ne szaladjon el.
- **Riasztások** — B0 óta jelez, ha az emlékezet leáll.
- **Az egy AI (B8)** — a tervezett mély változat.

## Hogyan működik
Alapelv: **a kód számol, a modell fogalmaz.** A pontszámokat, ütközéseket, célokat a háttérrendszer saját szabályai
számolják; az AI csak szavakba önti őket Boop hangján. Ha az AI nem válaszol időben vagy hibázik, szabály alapú szöveg
áll be helyette, így a reggeli összefoglaló sosem marad el. Minden AI-hívás naplózva van költséggel együtt, és egy
felhasználónkénti havi keret védi a kiadást.

## Miért így
- **Semmi nem változik a koppintásod nélkül** (standalone terv, 2026-11-11).
- **Egy hang: Boop** (Döntések naplója #5).
- **Javítás először** (B0): a kutatás kiderítette, hogy az emlékezet három hete nem tudott új emléket felvenni, és senki
  nem kapott jelzést. Ezt a B0 rendbe tette, mielőtt bármi erre épülne.

## Beállítások
Nincs összefoglaló beállítás; a részoldalak sorolják a sajátjukat.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `llm_log_history` | Minden AI-hívás naplója: mire, melyik modell, mennyi idő, mennyibe került |
| `memory_item` / `memory_vector` | Az emlékek és a kereshetővé tett változatuk |
| `knowledge_fact` | A megerősített tények rólad |

## Mi jön még
- **B3 (ellenőrzés alatt):** a chat látja a mai napot; esti és kitöltés utáni egymondatos sorok.
- **B6:** a Terv szabályai minden AI-szövegben.
- **B7:** élő újratervezés javaslatkártyákkal; naptáresemények pontozása (címek csak tulajdonosi engedéllyel).
- **B8:** emlékezet strukturált napi adatokkal, napra szabott kis tanács, időtávos következtetések.

## Mi marad ki
A webes csapatfal, szakértői oldalak, a 47 „érzékelő” átláthatósági felülete, fejezetek és érettségi gyűrű — a háttérben
maradnak, Boopban nem jelennek meg.
