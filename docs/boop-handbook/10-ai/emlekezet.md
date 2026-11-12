---
cim: Az emlékezet
szint: Funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B0]
osszefoglalo: Boop megjegyzi, amit írsz és mondasz, éjjel összefoglalja a napjaidat, és ha kell, tartalom szerint visszakeresi a régi emlékeket.
---

## Mit csinál
A háttérrendszer hosszú távú emlékezetet épít. Ami bekerül (például): beszélgetések, napi összefoglalók, heti és havi
összefoglalók, kitöltések jegyzetei, napló, hála-bejegyzések, döntések, esti gondolatok. Amikor egy AI-szövegnek szüksége
van a múltra (reggeli üzenetek, heti áttekintés, hipotézisek, vagy ha a chat rákeres), az emlékezet kiválasztja a
legrelevánsabb darabokat.

## Hogyan működik
1. **Emlékké válás:** minden új szövegből egy keresésre előkészített darab lesz (2 000 karakteres szeletekben), plusz egy
   „jelentés-lenyomat” (beágyazás), ami alapján tartalom szerint, nem csak szóegyezéssel kereshető.
2. **Éjjeli munka:** 02:20-kor a tegnapi napról összefoglaló készül; hétfőnként heti, minden hónap elején havi
   összefoglaló. Ezek is az emlékezetbe kerülnek.
3. **Visszakeresés:** négy kereső fut egyszerre — jelentés szerinti, szöveges, a tények között, és egy kapcsolati háló
   („ki/mi mivel függ össze”). Az eredményeket egy közös rangsorba fésüli, és csak annyit ad tovább, amennyi a keretbe fér.
4. **Elfelejtés:** a „ezt ne jegyezd meg” kérésre a szöveg nem kerül be, és vissza sem hívható.
5. Minden keresés naplózva van (30 napig), hogy utólag ellenőrizhető legyen.

**B0 javítás (2026-11-11):** a lenyomatokat készítő Google-keret 2026-10-21-én kifogyott, ezért három hétig új emlék nem
került be. A B0 a lenyomat-készítést OpenAI-ra költöztette, minden emléket újra feldolgozott, a szöveges keresőnek rövid
kulcsszavas kérdést ad (a hosszú „adat-halmok” helyett), és a határidejét a tényleges indulástól méri.

## Miért így
A kutatás (2026-11-10) szerint a motor tervben jó, de élesben szinte nem működött. A B0 javítás azért jött előbb mindennél,
mert Boop későbbi AI-funkciói erre épülnek.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.companion.embedding.embed-max-chars` | Egy emlékszelet mérete | 2 000 karakter |
| `mezo.companion.memory-platform.serving-mode` | Melyik keresőút szolgál (régi / párhuzamos próba / új); élesben az új | párhuzamos próba (élesben: új) |
| `mezo.companion.memory-platform.execution.retriever-timeout-ms` | Egy kereső időkerete | 200 ms |
| `mezo.companion.memory-platform.execution.retriever-queue-wait-ms` | Mennyit várhat egy kereső a sorban indulás előtt (B0) | 2 000 ms |
| `mezo.companion.memory-platform.serving.chat-max-tokens` | Mennyi emlék fér a chat elé | kb. 1 200 egység |
| `mezo.companion.memory-platform.reranker.enabled` | AI-alapú újrarangsorolás be/ki | ki |
| `mezo.companion.summary.cron` | A napi összefoglaló ideje | minden nap 02:20 |
| `mezo.companion.consolidation.weekly-cron` / `monthly-cron` | Heti és havi összefoglaló ideje | hétfő 03:30 / hó 1. 03:50 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `memory_item` | Egy emlékszelet: forrás, szöveg, keresési index |
| `memory_vector` | Az emlékszelet „jelentés-lenyomata” modellverziónként |
| `memory_embedding` | A régi rendszer lenyomatai (már csak tartalékként) |
| `memory_retrieval_run` / `memory_retrieval_result` | Minden keresés és a talált darabok naplója (30 nap) |
| `memory_forget_veto` | Amit kérésre elfelejtett |
| `daily_summary` / `period_summary` | Napi, illetve heti/havi összefoglalók |
| `knowledge_node` / `knowledge_edge` | A kapcsolati háló (minták, emberek, célok, életesemények) |

## Mi jön még
**B8:** strukturált napi adatok (étkezés, edzés, óra-adatok) is bekerülnek az emlékezetbe; ma még nincsenek benne.

## Mi marad ki
Az emlékezet felülete Boopban — csak a webes admin oldalon látható. Ismert maradék (2026-11-12): a nagyobb múltú fióknál a
szöveges kereső még mindig kifut az időből; jegyként nyitva.
