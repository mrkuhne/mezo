# OpenAI migráció — kickoff prompt friss sessionhöz

Ezt a fájlt **nem kell elolvasni a munkához** — a `## Prompt` szakasz tartalmát kell bemásolni
egy friss Claude Code sessionbe. Minden szelet után ugyanez a prompt adható be újra: a session
a bd állapotából deríti ki, hol tart az epic.

## Prompt

```
Az `mezo-ozri` epicet (OpenAI migráció) visszük végig, szeletenként.

Olvasd el ebben a sorrendben, mielőtt bármit csinálsz:
1. `bd prime`, majd `bd show mezo-ozri` és a hat gyerek (`mezo-ozri.1` … `.6`) — a leírásuk
   tartalmazza a konkrét fájl:sor horgonyokat és a csapdákat.
2. `docs/superpowers/specs/2026-09-06-openai-migration-design.md` — a teljes design: döntési
   tábla (P1/M1/M2/E1/A1/R1/C1/C2/Q1/L1), unit economics, config-vázlat, 13 pontos csapdalista.
3. `AGENTS.md` és `CLAUDE.md` — házirend: beads, git-flow, docs-mandátum, teszt-fegyelem.

Válaszd ki a következő nyitott szeletet `bd ready` alapján (a sorrend: .1 → .2 → .3 → .4/.5 → .6;
.4 és .5 párhuzamosítható .2 után, .6 a .1-et ÉS a .4-et igényli). Egy session = egy szelet.

Menet:
- `superpowers:brainstorming` NEM kell újra: a design megvan. Ugorj a
  `superpowers:writing-plans`-re a kiválasztott szeletre, majd `superpowers:executing-plans`.
- TDD: `superpowers:test-driven-development`. A repo fake-first: a `companion-fake` profil és a
  `FakeCompanionLlm` a teljes IT-felület alapja.
- Git: `bd update <id> --claim`, saját `feat/<topic>` ág, conventional commit a bd id-vel,
  `git push` → self-PR → **CI zöld** → lokális `--no-ff` merge → `git push` main → ág törlése.
  A self-PR nem review, hanem a CI-kapu: a teljes backend IT-suite csak ott fut le.
- Lokálisan csak fókuszált teszteket futtass. A fókuszált ITek KIHAGYJÁK az ArchUnitot és a
  CODEMAP-kaput — ha a `feature/companion/llm` alatt fájlt adtál hozzá vagy neveztél át,
  regeneráld a `docs/CODEMAP.md`-t ugyanabban a változásban.
- `superpowers:verification-before-completion`: bizonyíték a kijelentés előtt, mindig.

Nem alkudható meg (ezek már megégettek volna minket):
- A `@Qualifier` a `ChatModel` injektáláson **a második Spring AI starter előtt** kell (S1),
  különben minden context boot-time NoUniqueBeanDefinitionException — a 178 fake-profilos ITt is
  beleértve.
- A `spring-ai-starter-model-google-genai` **marad** a buildben: a `GeminiEmbeddingAdapter` az
  általa adott `com.google.genai.Client` beant injektálja.
- Az OpenAI adapter **kötelezően** override-olja a `completeSmart`-ot, különben az interface
  default mind a 19 smart-tier hívást némán a cheap tierre viszi.
- Prompt-szöveg átrendezése eltöri a `FakeCompanionLlm` prefix-alapú dispatchét és vele az egész
  IT-felületet (`CompanionMessageGenerator:75,100,114,139`).
- A pricing-kulcsok `application.yml`-ben szögletes zárójelesek (`"[gpt-5.6-luna]"`).
- Minden hangolható érték `application.yml`-be megy, `@ConfigurationProperties` recordon át —
  a `@Value` ArchUnit-tiltott.
- A `GEMINI_API_KEY` marad (embedding, audio, fallback); az `OPENAI_API_KEY` MELLÉ jön.

Állj meg és kérdezz, ha:
- a szelet designja ellentmond a specnek (a spec a döntés, nem a kód);
- a `.4` reasoning-effort spike azt hozza, hogy a Spring AI 2.0.0-ból nem adható át a
  `reasoning_effort` (ekkor providerváltás helyett adapter-döntés kell);
- a `.3` evalja szerint a `gpt-5.6-luna` nem éri el az incumbent baseline-t.

Kezdd azzal, hogy megmondod, melyik szeletet viszed és mi a terved — utána vágj bele.
```

## Miért így

Egy session = egy szelet, mert a repo git-flow-ja szeletenként kér self-PR-t és CI-kaput, és
mert a `.3` eval kapuja után a `.4`–`.6` tartalma függhet az eredménytől. A prompt szándékosan
nem ismétli meg a spec tartalmát: a spec a forrás, a prompt csak odairányít és a nem alkudható
pontokat emeli ki, mert azok azok, amiket egy friss session a kód olvasásából nem sejt meg
időben.
