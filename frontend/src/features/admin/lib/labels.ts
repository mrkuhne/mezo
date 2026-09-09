// Hungarian label dictionary for the admin surface (mezo-l096 slice 0).
// RULE: no raw slug/table/screen key may render on a default admin view — always go
// through these helpers. Unknown keys come back with { missing: true } so the UI can
// show the raw key WITH a visible "nincs címke" marker instead of silently lying.
// The completeness gate (labels.completeness.test.ts) fails when a backend
// LlmCallContext slug has no entry here.

export interface AdminLabel {
  label: string
  hint?: string
  missing?: boolean
}

export type AdminLabelEntry = { label: string; hint?: string }
type Entry = AdminLabelEntry

export const FEATURE_LABELS: Record<string, Entry> = {
  // ── LLM feature slugs (source of truth: `new LlmCallContext("<slug>"` call sites) ──
  activity_classify: { label: 'Aktivitás-besorolás', hint: 'naplóbejegyzések automatikus besorolása' },
  // VERIFIED: PortraitWriter/KonziliumProposalRound/KonziliumVerdictRound/
  // CharacterObservationService/KonziliumCrossTalkRound — the weekly "Karakter" konzílium:
  // szakértők megfigyelnek, javaslatot tesznek, vitáznak, majd az Integrátor dönt a társ
  // személyiség-dimenzióiról; a döntés a portré prózáját is újraírja.
  character: { label: 'Karakter-fejlődés', hint: 'a társ személyiségének formálása (megfigyelés, vita, döntés, portré)' },
  companion: { label: 'Társ (általános)', hint: 'nem besorolt társ-hívások' },
  // VERIFIED: TurnVerdictCheck/CompanionAdvisorChain — nem "tanácsadás", hanem a társ SAJÁT
  // válaszának utólagos ellenőrzése (ismétlés, alátámasztás nélküli állítás) és javító újra-kérés.
  companion_advisor: { label: 'Válasz-ellenőrzés', hint: 'a társ saját válaszának utólagos ellenőrzése és javítása' },
  companion_chat: { label: 'Beszélgetés a társsal', hint: 'a chat válaszai' },
  companion_consolidation: { label: 'Emlék-feldolgozás', hint: 'éjszakai emlék-összegzés' },
  companion_daily_summary: { label: 'Napi összefoglaló', hint: 'a nap AI-összegzése' },
  companion_fact_extract: { label: 'Tény-kinyerés', hint: 'tanult tények kigyűjtése' },
  companion_graph: { label: 'Tudásgráf-építés', hint: 'kapcsolatok felismerése' },
  // VERIFIED: HypothesisPipelineService — mintázat-figyelésből (PatternMonitorResponse)
  // származó feltevések javaslata, kritikája és felülvizsgálata; a guess helyes volt.
  companion_hypothesis: { label: 'Hipotézis-készítés', hint: 'feltevések a felismert mintázatokból' },
  companion_profile: { label: 'Profil-frissítés', hint: 'a rólad alkotott kép frissítése' },
  companion_quarterly: { label: 'Negyedéves áttekintés' },
  companion_recall: { label: 'Emlék-felidézés', hint: 'régi emlékek előhívása chathez' },
  // VERIFIED: TextSignalExtractor/QuickNoticeService — nem a társ reflektál önmagára, hanem a
  // FELHASZNÁLÓ naplószövegéből olvas ki hangulat/energia/stressz jelzéseket, majd ebből ad
  // gyors visszajelzést.
  companion_reflection: { label: 'Napló-jelzés kiolvasás', hint: 'napló-szövegek hangulat/energia jelzéseinek felismerése' },
  companion_smoke: { label: 'Rendszer-próbahívás', hint: 'technikai ellenőrző hívás' },
  day_review: { label: 'Napi értékelés' },
  embed_memory: { label: 'Emlék indexelése', hint: 'emlékek kereshetővé tétele (beágyazás/embedding)' },
  habit_ai_suggest: { label: 'Szokás-javaslat' },
  lifegoal_propose: { label: 'Életcél-javaslat' },
  meal_coach: { label: 'Étkezési tanácsadó' },
  meal_draft: { label: 'Étel-felismerés', hint: 'fotóból/szövegből étkezés-vázlat' },
  // VERIFIED: MesoReviewGenerator — a lezárt mezociklus (edzésblokk) VÉGÉRTÉKELÉSÉNEK
  // AI-narratívája a frissen összeállított kontextusból (deterministikus riport + életmód-adatok).
  meso_review: { label: 'Edzésblokk-értékelés', hint: 'a lezárt mezociklus AI-végértékelése (LlmCallContext: meso_review)' },
  pantry_photo: { label: 'Kamra-fotó felismerés' },
  // VERIFIED: ScrapeExtractionService — nem letöltés, hanem a már letöltött termékoldal
  // szövegéből tápérték-adatok kinyerése (kiolvasás/értelmezés).
  pantry_scrape: { label: 'Termékadat-kiolvasás', hint: 'termékoldal szövegéből tápérték-adatok kinyerése' },
  people_extraction: { label: 'Személy-felismerés', hint: 'emberek felismerése a naplóból' },
  proactive_advice: { label: 'Proaktív tanács' },
  proactive_challenge: { label: 'Kihívás-javaslat' },
  // VERIFIED: DiagnosisGenerator — egy mintázatra (pl. rossz alvás) lehetséges okok
  // ("gyanúsítottak") feltárása bizonyítékokkal; a guess helyes volt, hint pontosítva.
  proactive_diagnosis: { label: 'Mintázat-diagnózis', hint: 'lehetséges okok feltárása egy felismert mintázatra' },
  proactive_experiment: { label: 'Kísérlet-javaslat' },
  proactive_feed: { label: 'Üzenőfal-üzenetek' },
  proactive_memoir: { label: 'Memoár-írás' },
  proactive_prediction: { label: 'Előrejelzés' },
  proactive_weekly: { label: 'Heti javaslat' },
  proactive_weekly_review: { label: 'Heti értékelés' },
  // VERIFIED: QuestFlavor — a napi küldetések cím/indoklás szövegét írja át a társ hangnemére
  // (a metrika/küszöb/XP soha nem változik); a guess iránya helyes volt, pontosítva.
  quest_flavor: { label: 'Küldetés-szöveg átírás', hint: 'napi küldetések szövegének társ-hangvételre igazítása' },
  recipe_breakdown: { label: 'Receptbontás' },
  recipe_workshop: { label: 'Receptműhely' },
  // VERIFIED: SleepShotService — a Sleep Cycle app KÉPERNYŐKÉPÉBŐL olvassa ki az alvás adatait
  // (lefekvés/ébredés/fázisok) egy multimodális hívással, majd vázlatot készít belőle.
  sleep_shot: { label: 'Alvás-képernyőkép beolvasás', hint: 'Sleep Cycle képernyőkép adatainak kiolvasása' },
  // VERIFIED: SlotPlanEvaluationService — nem tervezés, hanem egy MEGLÉVŐ étkezési
  // idősáv-beosztás (vázlat) bírálata a cél-egyensúly és az edzés-időzítés ellen.
  slot_template: { label: 'Étkezés-időzítés értékelése', hint: 'a napi étkezés-idősáv beosztás bírálata' },
  // VERIFIED: PlacementEngine — egy kamra-termék (pl. kiegészítő) napszaki idősávba
  // (reggeli/ebéd/stb.) sorolása, ha a szabálytábla és a kamra-időzítési jelzés nem dönt.
  stack_placement: { label: 'Kiegészítő napszak-besorolás', hint: 'egy kamra-tétel idősávba sorolása, ha a szabályok nem döntenek' },
  train_meso_plan: { label: 'Edzésterv-készítés' },
  unknown: { label: 'Ismeretlen hívás', hint: 'a hívó nem hagyott azonosítót' },
  admin_replay: { label: 'Admin próba-felidézés', hint: 'a memória-böngésző tesztfuttatása' },
  // ── activity-domain keys (mezo.admin-insights.feature-map, application.yml) ──
  train: { label: 'Edzés' },
  food: { label: 'Étkezés' },
  sleep: { label: 'Alvás' },
  journal: { label: 'Napló' },
  habits: { label: 'Szokások' },
  water: { label: 'Víz' },
  weight: { label: 'Testsúly' },
}

// Telemetry screen route patterns (screen_event.screen), matching the real routes in
// frontend/src/app/router.tsx (top-level app routes) and
// frontend/src/features/admin/adminRoutes.tsx (the /admin subtree). Best-effort: covers
// the app's main hub routes + the whole admin subtree; unknown patterns fall back honestly.
export const SCREEN_LABELS: Record<string, Entry> = {
  '/': { label: 'Kezdő-átirányítás', hint: 'a Ma fülre irányít tovább' },
  '/nap': { label: 'Ma fül (kezdőlap)' },
  '/train': { label: 'Edzés fül' },
  '/fuel': { label: 'Étkezés fül' },
  '/mezo': { label: 'Mezo (társ) fül' },
  '/mezo/chat': { label: 'Beszélgetés' },
  '/me': { label: 'Én fül' },
  '/admin': { label: 'Admin · áttekintés' },
  '/admin/users': { label: 'Admin · emberek' },
  '/admin/users/:id': { label: 'Admin · tesztelő-részlet' },
  '/admin/users/:id/memory': { label: 'Admin · emlék-böngésző' },
  // '/admin/usage' is a redirect-only route (mezo-kxnn) — `/admin/features` is the live screen
  // now; the old entry is gone rather than kept as a second label for a route nothing renders.
  '/admin/features': { label: 'Admin · funkciók' },
  '/admin/features/:key': { label: 'Admin · funkció-részlet' },
  '/admin/data': { label: 'Admin · adatböngésző' },
  '/admin/cost': { label: 'Admin · költség-áttekintés' },
  '/admin/cost/:id': { label: 'Admin · költség-részlet' },
  '/admin/accounts': { label: 'Admin · fiókok' },
}

// Browsable table names (data browser + user-detail data inventory). Covers the
// convenience views + the highest-traffic owned tables; the rest falls back.
export const TABLE_LABELS: Record<string, Entry> = {
  mesocycle: { label: 'Mezociklusok' },
  workout_session: { label: 'Edzések' },
  exercise_set: { label: 'Gyakorlat-sorozatok' },
  meal: { label: 'Étkezések' },
  sleep_log: { label: 'Alvásnapló' },
  journal_entry: { label: 'Naplóbejegyzések' },
  habit_day: { label: 'Szokás-napok' },
  water_log: { label: 'Vízfogyasztás' },
  weight_log: { label: 'Testsúly-mérések' },
  pattern: { label: 'Minták' },
  pattern_event: { label: 'Minta-események' },
  llm_log_history: { label: 'AI-hívások naplója' },
  memory_item: { label: 'Emlékek' },
  memory_vector: { label: 'Emlék-keresőindex', hint: 'emlékek beágyazás (embedding) alapú keresőindexe' },
  knowledge_node: { label: 'Tudástár-elemek', hint: 'tudásgráf-csomópontok' },
  knowledge_edge: { label: 'Tudástár-kapcsolatok', hint: 'tudásgráf-élek' },
  learned_fact: { label: 'Tanult tények' },
  message_feedback: { label: 'Visszajelzések' },
  ai_message: { label: 'AI-üzenetek' },
  app_user: { label: 'Fiókok' },
  screen_event: { label: 'Képernyő-megnyitások' },
}

// Message-feedback down-reason keys (`message_feedback.reason`) — the feature detail page's
// downReasons list (mezo-kxnn Task 3). 4 entries per the plan's self-review note; `not_about_me`
// has no seeded mock row today but is a real reason key, so it is labelled here regardless.
export const FEEDBACK_REASON_LABELS: Record<string, Entry> = {
  inaccurate: { label: 'Pontatlan' },
  too_much: { label: 'Túl sok' },
  bad_timing: { label: 'Rossz időzítés' },
  not_about_me: { label: 'Nem rólam szól' },
}

// Companion feedback surfaces (`message_feedback.artifact_kind`) — the Emberek detail's
// Visszajelzések tab (mezo-zde2 Task 3). 7 artifact kinds per the plan; a raw kind never renders
// without going through `surfaceLabel` first, same honest-fallback contract as every other
// dictionary here.
export const SURFACE_LABELS: Record<string, Entry> = {
  chat_message: { label: 'Beszélgetés' },
  feed_message: { label: 'Üzenőfal' },
  weekly_suggestion: { label: 'Heti javaslat' },
  weekly_review: { label: 'Heti értékelés' },
  memoir: { label: 'Memoár' },
  prediction: { label: 'Előrejelzés' },
  day_review: { label: 'Napi értékelés' },
}

// Memory-explorer terms (mezo-k5zy Task 3) — closes the slice-0 deferred "every memory term"
// promise: every raw backend key the Gráf/Térkép/Felidézések views render gets a Hungarian name
// here, same honest-fallback contract as every other dictionary in this file. Four families,
// one flat record (no collisions — a retriever key, a node kind, an edge kind and a vector
// status never share a spelling):
//   - retriever sources (`AdminMemoryScoreBreakdown.retrieverRanks` keys / RunDetail's own
//     `RETRIEVER_COLORS` universe)
//   - node kinds (`AdminMemoryGraphNode.kind`, GraphView's `KIND_COLOR` universe)
//   - edge kinds (`AdminMemoryGraphEdge.kind`) — the hint carries the one-liner the Gráf legend
//     needs ("what does this edge MEAN"), not just a translated key
//   - vector states (`AdminMemoryHealthResponse.vectorsByStatus`/`AdminMemoryGlobalHealthResponse`
//     keys)
export const MEMORY_TERM_LABELS: Record<string, Entry> = {
  // ── retriever sources ──
  dense: { label: 'Tartalmi hasonlóság', hint: 'beágyazás (embedding) alapú keresés' },
  lexical: { label: 'Szó szerinti egyezés', hint: 'kulcsszó/szöveg alapú keresés' },
  graph: { label: 'Tudásgráf', hint: 'a tudásgráf kapcsolatain át talált emlék' },
  facts: { label: 'Rögzített tény', hint: 'egy korábban tanult, rögzített tény' },
  // ── node kinds (knowledge_node.kind) ──
  PATTERN: { label: 'Minta', hint: 'ismétlődő viselkedési/érzés-mintázat' },
  PREFERENCE: { label: 'Preferencia', hint: 'amit a felhasználó kedvel vagy kerül' },
  GOAL: { label: 'Cél', hint: 'kimondott vagy levezetett cél' },
  LIFE_EVENT: { label: 'Élet-esemény', hint: 'egyszeri, jelentős esemény' },
  SEASON: { label: 'Időszak', hint: 'egy életszakasz vagy időszak jellemzője' },
  INSIGHT: { label: 'Felismerés', hint: 'a társ által levont következtetés' },
  PERSON: { label: 'Személy', hint: 'a naplóban említett ember' },
  // ── edge kinds (knowledge_edge.kind) — hint = the legend's "what this arrow means" one-liner ──
  TRIGGERS: { label: 'Kiváltja', hint: 'az egyik csomópont kiváltja a másikat' },
  PRECEDED_BY: { label: 'Megelőzi', hint: 'az egyik csomópont időben megelőzi a másikat' },
  SUPPORTS: { label: 'Alátámasztja', hint: 'az egyik csomópont megerősíti a másikat' },
  CONFLICTS: { label: 'Ellentmond', hint: 'a két csomópont ellentmond egymásnak' },
  RELATES_TO: { label: 'Kapcsolódik', hint: 'általános, kevésbé pontosan jellemzett kapcsolat' },
  // ── vector states (memory_vector status) ──
  ready: { label: 'Kész', hint: 'kereshető, beágyazott vektor' },
  pending: { label: 'Folyamatban', hint: 'beágyazásra vár' },
  failed: { label: 'Elakadt', hint: 'a beágyazás sikertelen volt' },
}

function resolve(record: Record<string, Entry>, key: string): AdminLabel {
  const hit = record[key]
  return hit ? { ...hit } : { label: key, missing: true }
}

export function featureLabel(key: string): AdminLabel {
  return resolve(FEATURE_LABELS, key)
}

export function screenLabel(pattern: string): AdminLabel {
  return resolve(SCREEN_LABELS, pattern)
}

export function tableLabel(name: string): AdminLabel {
  return resolve(TABLE_LABELS, name)
}

export function feedbackReasonLabel(reason: string): AdminLabel {
  return resolve(FEEDBACK_REASON_LABELS, reason)
}

export function surfaceLabel(kind: string): AdminLabel {
  return resolve(SURFACE_LABELS, kind)
}

export function memoryTermLabel(key: string): AdminLabel {
  return resolve(MEMORY_TERM_LABELS, key)
}
