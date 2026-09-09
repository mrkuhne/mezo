---
title: Boop — játékos adatközpontú UX
type: query
updated: 2026-09-09
tags: [design, frontend, technique]
related: [mezo-ux-direction.md, ../../design_3.0/boop-rpg.md, ../index.md]
sources:
  - raw/articles/2026-09-08-yazio-ux-excerpt.md
  - raw/articles/2026-09-09-bitepal-play-excerpt.md
  - raw/articles/2026-09-09-duolingo-milestone-excerpt.md
  - raw/articles/2026-09-09-strava-records-excerpt.md
confidence: medium
contradictions: []
---

# Játékosság és adatsűrűség a Boopban

Daniel új irányt kért a korábbi kibővített editorial prototípus mellé. A területváltós navigáció marad; a termék adatalapú naplózás, hypertrophy/sport és személyes AI. A játékos megjelenés a számok gyors értelmezését szolgálja. A [korábbi kutatás](mezo-ux-direction.md) hierarchia-, feladatorientáltság- és kontextuselvei továbbra is érvényesek.

## Forrás → alkalmazott döntés

| Referencia | Forrásból igazolható | Boopban választott alkalmazás |
| --- | --- | --- |
| [Yazio napló](https://help.yazio.com/hc/en-us/articles/11804776635281-Tutorial-of-the-Yazio-app) | A napló fő mutatói az elfogyasztott, fennmaradó és elégetett kalóriák; a makrók és a rögzítés központi szerepet kapnak. | Az étkezési főoldal egy kalóriaműszer, három makrócsatorna és közvetlen étkezésrögzítés köré épül. |
| [Strava Best Efforts](https://support.strava.com/en-us/articles/15401646-best-efforts-overview) | Saját rekordok, időbeli összehasonlítás és visszalépés az eredeti aktivitáshoz. | Személyes gyakorlatrekordok és heti volumen külön, forrásra nyitható sorokban. A legnagyobb rögzített súly alapján választott prototípus-rekord nem másolja a Strava futóalgoritmusát. |
| [Duolingo mérföldkő-design](https://blog.duolingo.com/streak-milestone-design-animation/) | A mérföldkő vizuális és animációs visszajelzésének erejét külön tervezték. | Szintjelvény, XP-sáv, tapintható gombállapot és rövid mentési visszajelzés. Ez saját megoldás; nem állítjuk, hogy egészségappban ugyanazt a hatást hozza. |
| [BitePal alkalmazásleírás](https://apps.apple.com/us/app/food-calorie-tracker-bitepal/id6479529917) | Játékos étkezéskövetés, fotós bevitel, tápanyagmutatók és személyes kisállat. | Gyors bevitel, színes táplálkozási modul és Boop karaktere az Életem térben. Az avatart nem módosítottuk. |

## Sűrűség és értelmezhetőség

Egy képernyő egy nagy kiemelt felületet kap. Az összetartozó számok közös sorban vagy műszerben vannak; az összetett magyarázat a részletoldalon nyílik. A funkciónevek köznyelviek maradnak. A sci-fi világot saját SVG rangjelvény, moduljelvény, szegmentált kalóriagyűrű és izomtérkép adja.

A prototípusban a rögzített, azonosítóval rendelkező bejegyzések számítanak XP-nek; nem a kalóriadeficit vagy a nagyobb edzésterhelés. A pontok szerkesztéssel nem növelhetők. Az XP és az egészségi/teljesítményadatok külön jelentést hordoznak. A források nem bizonyítják e konkrét Boop-megoldás eredményességét; ez kipróbálható designhipotézis.

## Bizonyítékhatár

Hivatalos termékoldalakat és designleírást olvastunk, nem végigtesztelt, telepített appokat. A forrásokból választott elvek és a Boop saját megvalósítási döntései a táblázatban külön oszlopot kapnak. A [prototípus dokumentációja](../../design_3.0/boop-rpg.md) rögzíti a működést és az ellenőrzéseket.
