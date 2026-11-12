---
cim: Melyik AI mire
szint: Funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [S3, B0, B3]
osszefoglalo: Az app két szolgáltatót használ — az OpenAI ír és gondolkodik, a Google Gemini hallja a hangot és látja a fotókat — és minden feladat a hozzá illő, olcsó vagy okos modellt kapja.
---

## Mit csinál
| Feladat | Ki csinálja (élesben) | Szint |
|---|---|---|
| Chat: a „mit kell elővenni?” gondolkodás és a válasz | OpenAI, okos modell | okos |
| Reggeli összefoglaló szövege, egymondatos sorok, étkezés-értékelés, napi üzenetek | OpenAI, olcsó modell | olcsó |
| Nehéz háttérmunkák (hipotézisek, Szkeptikus, heti/negyedéves áttekintés, tények összefésülése) | OpenAI, okos modell | okos |
| Hang leírása szöveggé (hangnapló, chat-mikrofon szerver oldali tartaléka) | Google Gemini | hang |
| Fotók (étkezésfotó, címkefotó, alvás-képernyőkép) | Google Gemini | kép |
| Emlékek beágyazása (keresési lenyomat) | OpenAI kis beágyazó modell (B0 óta) | beágyazás |

## Hogyan működik
- Minden AI-hívás egy közös kapun megy át, ami tudja, melyik funkció kéri (például „reggeli összefoglaló”, „chat”).
- Egy útválasztó dönt a modellről, sorrendben: hívásfajta szerinti kivétel (hang, kép) → ha a költségkeret szűkül, olcsó
  modell → funkciónkénti kivétel → az alapértelmezett olcsó vagy okos szint.
- Modellt cserélni beállítással lehet, kódváltoztatás nélkül.
- Minden szöveg magyarul készül; angol fiókhoz egy angol nyelvi utasítás kerül a végére.
- A Google-modell tartalékként is megmaradt a chathez.

## Miért így
A webes app 2026 őszén költözött az OpenAI-ra a minőség és ár miatt; a hangot és a képet az OpenAI modellek nem (vagy még
nem mérten) tudják, ezért azok a Google-nál maradtak. Az árak az OpenAI-nál akciósak, és csak 2026-11-21-ig garantáltak —
utána újra kell számolni.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.companion.llm.provider` | Ki válaszol alapból: Google vagy OpenAI | Google (élesben: OpenAI) |
| `mezo.companion.llm.openai.chat-model` | Az olcsó OpenAI modell | gpt-5.6-luna |
| `mezo.companion.llm.openai.smart-model` | Az okos OpenAI modell | gpt-5.6-terra |
| `mezo.companion.llm.openai.reasoning-effort.smart` | Mennyit „gondolkodjon” az okos modell | magas |
| `mezo.companion.llm.gemini.chat-model` / `smart-model` | A Google modellek (tartalék, hang, kép) | gemini-2.5-flash / gemini-2.5-pro |
| `mezo.companion.llm.per-call-kind.TRANSCRIBE` / `VISION` | Hang és kép kivétel: melyik szolgáltató | Google / Google |
| `mezo.companion.llm.openai.feature-models` | Funkciónkénti modellcsere | üres |
| `mezo.companion.embedding.provider` | A beágyazás szolgáltatója | Google (élesben: OpenAI) |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `llm_log_history` | Minden hívásnál a kért és a ténylegesen használt modell, idő, tokenszám, költség |

## Mi jön még
Az árak újraszámolása 2026-11-21 után (akciós árak vége).

## Mi marad ki
Saját gépen futó modell az appban — nem tervezett.
