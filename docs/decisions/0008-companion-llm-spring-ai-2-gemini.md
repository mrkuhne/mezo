# 0008 — Companion LLM: Spring AI 2.0 + Google Gemini, behind a port

- **Status:** Accepted
- **Date:** 2026-07-03
- **Driver:** mezo-fnnq.1 (Phase 3 companion epic, slice V0.1 — gates every other slice)

## Context

Phase 3 puts an LLM into the Boot 4 backend (companion chat + AI memory). Slice V0.1 must
close three intertwined choices before any other slice can start: the **Spring AI version line**
(Boot 4 compatibility), the **chat provider + model tiers**, and the **API-key delivery** for
local dev + k3s. Requirements distilled from the design spec
(`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`):

- streaming chat (SSE at V0.4), tool calling (V0.5), structured output (V1.2 fact extraction);
- Hungarian companion voice — provider must be strong in Hungarian;
- embeddings later (V2.1) with the surviving invariant `vector(768)` + HNSW + cosine;
- single-user personal app → cost sensitivity is high, volume is tiny;
- everything switch-gated; **no LLM in tests** — the model sits behind a port with a
  deterministic fake (spec §6).

Constraints found during research (2026-07-03, web-verified):

- The backend is Spring Boot **4.0.0** (Framework 7, Jackson 3, Java 21). **Spring AI 2.0.0**
  (GA 2026-06-12) is the line designed for Boot 4.0/4.1 and **cannot** be replaced by 1.1.x,
  which is the Boot 3.5 maintenance line and does not load in a Boot 4 context.
- In the 2.0 line the Gemini module is `spring-ai-starter-model-google-genai` (Google Gen AI
  SDK); the old `spring-ai-vertex-ai-gemini` module was removed.
- Pricing snapshot (USD / 1M tokens, 2026-06-30): Gemini 2.5 Flash **$0.30/$2.50** (+ real
  free tier), Gemini 2.5 Pro $1.25/$10; Claude Haiku 4.5 $1/$5, Sonnet $3/$15 (no free tier,
  no embeddings API); OpenAI gpt-5.4-mini $0.75/$4.50. Gemini `gemini-embedding-001` $0.15.
- The dev machine already carries a `GEMINI_API_KEY`; the old-docs architecture and the
  embedding research (bd `mezo-c30`: `gemini-embedding-001` @ 768-dim) are both Gemini-lineage.

## Decision

1. **Spring AI 2.0.0**, imported via the `spring-ai-bom` (`<spring-ai.version>` property in
   `backend/pom.xml`). Bump patch versions freely as they appear.
2. **Provider: Google Gemini** through `spring-ai-starter-model-google-genai`.
3. **Model tiers are config, never code** — under `mezo.companion.llm.*`
   (`CompanionProperties`): `chat-model: gemini-2.5-flash` (cheap/fast default for every
   conversational turn) and `smart-model: gemini-2.5-pro` (reserved for the heavy pipelines:
   V3.2 hypothesis critique, possibly V1.2 extraction). Re-evaluate the defaults when v3 lands.
4. **API key:** the starter reads `spring.ai.google.genai.api-key: ${GEMINI_API_KEY:...}` with a
   dummy default so the context boots key-less (tests, CI, k3s-before-rollout). Local dev: shell
   env var (already present). k3s: when companion first deploys, add `GEMINI_API_KEY` to the
   `mezo-app` SealedSecret and wire it into the backend Deployment env (see
   `docs/infrastructure/deployment-k3s-argocd.md`).
5. **Port isolation:** all LLM access goes through the `CompanionLlm` interface
   (`feature/companion`, `RobustnessSource` port precedent). The real adapter
   (`GeminiCompanionLlm`, profile `!companion-fake`) and the deterministic fake
   (`FakeCompanionLlm`, profile `companion-fake`) are both gated on
   `mezo.feature.companion.enabled`. Integration tests activate `companion-fake` — the network
   is never touched in tests.

## Consequences

- **One key covers chat now and embeddings at V2.1** (`gemini-embedding-001`, 768-dim) — no
  second provider account; the V2.1 slice still re-validates the embedding choice per roadmap.
- Personal-scale cost is negligible (Flash + free tier); tiers are YAML-tunable without code.
- The starter autoconfigures a `ChatModel` bean **regardless of the mezo switch**; the dummy-key
  default is what keeps every environment bootable. Proven by the ITs (context boots with no
  real key) — keep this property in place.
- Provider swap stays cheap by design: one new adapter + one starter swap behind `CompanionLlm`;
  Anthropic and OpenAI both have first-class 2.0 starters (streaming/tools/structured output).
- Spring AI 2.0.0 is a 3-week-old GA: expect patch releases; the known Jackson-3 edge
  (spring-ai#5424, Kotlin tool-schema deserialization) does not affect this Java codebase, but
  tool calling gets a real smoke test at V0.5.
- The `companion-smoke` profile (`CompanionHelloRunner`) is the manual real-API proof:
  `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata,companion-smoke` with
  `GEMINI_API_KEY` set streams a Hungarian hello through the real adapter and exits the runner.

## Alternatives considered

- **Anthropic Claude** (Haiku 4.5 $1/$5 · Sonnet $3/$15) — best-in-class tool use and prose,
  but 3–10× Gemini's cost, no free tier, and **no embeddings API** (V2.1 would force a second
  provider + key). Rejected on cost + key-sprawl; stays one adapter away.
- **OpenAI** (gpt-5.4-mini $0.75/$4.50) — has embeddings and solid tooling, but ~2.5× Flash
  cost with no Hungarian-quality advantage and no lineage in this repo's research. Rejected.
- **Spring AI 1.1.x** — Boot 3.5-only; does not load on Boot 4. Not viable.
- **Direct Google Gen AI SDK (no Spring AI)** — loses ChatClient, the Advisor chain (V1.3),
  tool-calling infra (V0.5) and provider portability. Rejected.
