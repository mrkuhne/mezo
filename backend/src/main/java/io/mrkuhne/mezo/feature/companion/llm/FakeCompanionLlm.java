package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.ChatHistory;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.advisor.TurnVerdictCheck;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphEdgeStructurer;
import io.mrkuhne.mezo.feature.companion.graph.service.LifeEventExtractionService;
import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewService;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryService;
import io.mrkuhne.mezo.feature.companion.service.PeriodSummaryService;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.feature.companion.service.MesoReviewGenerator;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

/**
 * Deterministic in-process {@link CompanionLlm} for integration tests (spec §6: profile-gated
 * fake bean, not a Mockito mock — the network is never touched in tests). Echoes both prompt
 * halves so tests can assert exactly what the caller assembled; streams in fixed chunks so the
 * streaming path is exercised end to end.
 *
 * <p>V0.5 — scripted tool execution: every {@code [fake-tool:name {json}]} sentinel in the user
 * message invokes the matching REAL callback (registry decorator included), so ITs exercise the
 * audit/budget/refs pipeline deterministically without a model.
 */
@Component
@Profile("companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FakeCompanionLlm implements CompanionLlm {

    public static final String PREFIX = "FAKE-LLM";

    /** Content markers that force a deterministic failure — lets ITs exercise error paths. */
    public static final String FAIL_COMPLETE = "[fake-fail]";
    public static final String FAIL_STREAM = "[fake-stream-fail]";

    /** mezo-8z79: the provider answered with NO text at all — a candidate with zero text parts (the
     *  2026-08-23 live incident). Streams as an empty Flux and completes as "", so ITs can drive the
     *  blank-answer guard without a model. Deliberately NOT an exception: the whole point is that
     *  the turn succeeds technically and yields nothing. */
    public static final String EMPTY_ANSWER = "[fake-empty]";

    /** Scripted verdicts (V1.3): violate only until the retry header appears in the checked answer. */
    public static final String VIOLATE_ONCE = "[fake-violate]";
    /** Scripted verdicts (V1.3): violate every round — exercises the degraded path. */
    public static final String VIOLATE_ALWAYS = "[fake-violate-always]";
    /** Scripted verdicts (V1.3): answer with non-JSON — exercises the fail-open path. */
    public static final String VERDICT_BROKEN = "[fake-verdict-broken]";

    /** Scripted verdicts (mezo-q71s): proves the judge's payload carries the RENDERED history, not
     *  just the checked answer/userMessage — planted in a history {@code Turn}'s content, this
     *  string reaches the verdict payload ONLY through {@code ChatHistory.render(history)} inside
     *  {@code TurnVerdictCheck.check(...)}. If that render call is ever dropped, the sentinel
     *  disappears from the payload and this scripted verdict goes back to clean. */
    public static final String HISTORY_SEEN_SENTINEL = "[fake-verdict-saw-history]";

    /** Scripted verdicts (mezo-q71s): a MARKED speculation is clean — the policy's IT anchor.
     *  Proves the fake keeps the "jelölt sejtés" clean-verdict rule in sync with the real judge's
     *  VERDICT_PROMPT criterion #2, so the retry chain never fires on a linguistically hedged hunch. */
    public static final String MARKED_SPECULATION = "[fake-marked-spec]";

    /** Scripted verdicts (mezo-q71s): pins the renamed {@code unmarkedClaim} JSON key / {@code
     *  TurnVerdict} record component against the {@code "unmarked"} {@code AdvisorViolation} check
     *  name — the whole point of the {@code ungroundedClaim} -> {@code unmarkedClaim} / {@code
     *  "grounding"} -> {@code "unmarked"} rename. If the VERDICT_PROMPT's JSON key and the
     *  TurnVerdict record component ever diverge (a prompt reword, a partial revert), Jackson
     *  silently defaults the field to false — no violation, no retry, no degrade — and this
     *  scripted verdict goes back to clean. */
    public static final String UNMARKED_CLAIM_SENTINEL = "[fake-unmarked-claim]";

    /** Scripted tool execution: {@code [fake-tool:get_recovery {"scope":"sleep","days":3}]} runs the real callback. */
    public static final Pattern TOOL_SENTINEL = Pattern.compile("\\[fake-tool:([a-z_]+)(?: (\\{.*?\\}))?]");

    /** Scripted transcript (mezo-at8x.4): {@code [fake-transcript:…]} decoded from AUDIO BYTES. */
    public static final Pattern TRANSCRIPT_SENTINEL =
            Pattern.compile("\\[fake-transcript:([^\\]]*)]", Pattern.DOTALL);

    /** Scripted extraction (V1.2): {@code [fake-facts:<json-array>]} is returned verbatim to extraction calls. */
    public static final Pattern FACTS_SENTINEL =
            Pattern.compile("\\[fake-facts:(\\[.*?]|[^\\]]*)]", Pattern.DOTALL);

    /** Mirror of CharacterObservationService.OBSERVATION_MARKER (feature/character) — a LITERAL,
     *  not an import: character already depends on companion via the CompanionLlm port, so a
     *  companion -> character import here would be a NEW package cycle
     *  (feature_slices_are_cycle_free). Drift is caught by CharacterObservationServiceIT's
     *  equality assertion against the real constant. */
    public static final String OBSERVATION_MARKER_MIRROR = "KARAKTER-MEGFIGYELÉS-FELADAT";

    /** Scripted observation pass (mezo-1gim.3): {@code [fake-char-obs:<json-array>]} planted in
     *  the gathered signal text (e.g. a journal entry) is returned verbatim; otherwise a canned
     *  single-observation array keeps the pipeline deterministic. */
    public static final Pattern CHAR_OBS_SENTINEL =
            Pattern.compile("\\[fake-char-obs:(\\[.*?])]", Pattern.DOTALL);

    /** Mirror of KonziliumProposalRound.PROPOSAL_MARKER (feature/character) — LITERAL, cycle rule
     *  (see {@link #OBSERVATION_MARKER_MIRROR} for the full rationale). Drift is caught by an IT's
     *  equality assertion against the real constant. */
    public static final String PROPOSAL_MARKER_MIRROR = "KARAKTER-JAVASLAT-FELADAT";

    /** Mirror of CharacterBootstrapService.BOOTSTRAP_MARKER (feature/character) — LITERAL, cycle
     *  rule (see {@link #OBSERVATION_MARKER_MIRROR}). The bootstrap konzílium's proposal round
     *  asks for the SAME proposal JSON shape as the weekly round, so it shares the proposal
     *  branch's answer logic below — same canned fallback, same sentinel. Drift is caught by an
     *  IT's equality assertion against the real constant. */
    public static final String BOOTSTRAP_MARKER_MIRROR = "KARAKTER-BOOTSTRAP-FELADAT";

    /** Mirror of CharacterMonthlyService.MONTHLY_MARKER (feature/character) — LITERAL, cycle rule
     *  (see {@link #OBSERVATION_MARKER_MIRROR}). The monthly deep-read konzílium's proposal round
     *  asks for the SAME proposal JSON shape as the weekly/bootstrap rounds, so it shares that
     *  branch's answer logic below — same canned fallback, same sentinel. The marker is a
     *  MULTI-LINE block (the monthly drift/staleness contract rides along after the routing
     *  line) — {@code startsWith} still matches it as a literal prefix. Drift is caught by an
     *  IT's equality assertion against the real constant. */
    public static final String MONTHLY_MARKER_MIRROR = "KARAKTER-HAVI-FELADAT\n"
            + "Ez egy HAVI mélyolvasás: ne friss mintát keress, hanem a hónapok óta lassan alakuló "
            + "ELMOZDULÁST és az adatok által már nem alátámasztott, elavult állításokat figyeld. "
            + "UP/DOWN/RETIRE javaslatot részesíts előnyben NEW helyett, és javasolj RETIRE-t "
            + "mindenre, amit a jelenlegi adatok már nem támasztanak alá.";

    /** Scripted konzílium proposals (mezo-1gim.5): {@code [fake-char-proposals:[…]]} planted in an
     *  observation's TEXT (the user message renders it) is returned verbatim; otherwise a canned
     *  single-proposal array keeps the pipeline deterministic, keyed on the expert's own
     *  "Alapértelmezett dimenzió: <key>" line KonziliumProposalRound always appends. */
    public static final Pattern CHAR_PROPOSALS_SENTINEL =
            Pattern.compile("\\[fake-char-proposals:(\\[.*])]", Pattern.DOTALL);

    /** Resolves KonziliumProposalRound's trailing "Alapértelmezett dimenzió: <key>" line so the
     *  canned proposal always names a dimension the round's own validation will accept. */
    private static final Pattern PROPOSAL_DEFAULT_DIMENSION =
            Pattern.compile("Alapértelmezett dimenzió: ([a-z]+)");

    /** Scripted proposal ECHO (mezo-1gim.10): {@code [fake-char-proposals-echo]} planted in an
     *  observation's TEXT returns the FULL assembled user message (JSON-escaped) as a single NEW
     *  proposal's {@code rationale} — the "prompt assembly is assertable" idiom (see
     *  {@link #MESO_REVIEW_ECHO}), applied here so an IT can prove a server-side prompt-assembly
     *  detail (e.g. the routed user-feedback observation's "DANIEL VÁLASZA —" prefix) actually
     *  reached the expert's prompt, without the fake needing to keep a prompt recorder. */
    public static final String CHAR_PROPOSALS_ECHO = "[fake-char-proposals-echo]";

    /** Mirror of KonziliumVerdictRound.SKEPTIC_MARKER (feature/character) — LITERAL, cycle rule. */
    public static final String SKEPTIC_MARKER_MIRROR = "KARAKTER-SZKEPTIKUS-FELADAT";
    /** Mirror of KonziliumVerdictRound.INTEGRATOR_MARKER (feature/character) — LITERAL, cycle rule. */
    public static final String INTEGRATOR_MARKER_MIRROR = "KARAKTER-INTEGRATOR-FELADAT";

    public static final Pattern CHAR_SKEPTIC_SENTINEL =
            Pattern.compile("\\[fake-char-skeptic:(\\[.*])]", Pattern.DOTALL);
    public static final Pattern CHAR_INTEGRATOR_SENTINEL =
            Pattern.compile("\\[fake-char-integrator:(\\{.*})]", Pattern.DOTALL);
    /** The proposal numbering the konzílium user messages carry — the canned answers count these. */
    private static final Pattern CHAR_PROPOSAL_INDEX = Pattern.compile("(?m)^P(\\d+)\\. ");

    /** Mirror of PortraitWriter.PORTRAIT_MARKER (feature/character) — LITERAL, cycle rule. */
    public static final String PORTRAIT_MARKER_MIRROR = "KARAKTER-PORTRE-FELADAT";

    /** Scripted portrait rewrite (mezo-1gim.5): {@code [fake-char-portrait:<text>]} planted in a
     *  claim's TEXT (the user message renders every active claim's text) is returned verbatim —
     *  including an EMPTY payload ({@code [fake-char-portrait:]}), which surfaces as a blank
     *  answer so tests can drill the portrait-failure-isolation path; otherwise a canned portrait
     *  sentence keeps the pipeline deterministic. */
    public static final Pattern CHAR_PORTRAIT_SENTINEL =
            Pattern.compile("\\[fake-char-portrait:([^\\]]*)]", Pattern.DOTALL);
    private static final String CHAR_PORTRAIT_CANNED_ANSWER =
            "Ezen a héten a fegyelem képe formálódik. Figyeljük tovább.";

    /** Scripted scrape (mezo-8vum): {@code [fake-scrape:{json}]} payload is returned verbatim. */
    public static final Pattern SCRAPE_SENTINEL =
            Pattern.compile("\\[fake-scrape:(\\{.*?})]", Pattern.DOTALL);

    /** Scripted photo import (mezo-d8tr): {@code [fake-photo:{json}]} decoded from IMAGE BYTES —
     *  the flat draft JSON nests no objects, so the non-greedy match is safe (unlike meal). */
    public static final Pattern PHOTO_SENTINEL =
            Pattern.compile("\\[fake-photo:(\\{.*?})]", Pattern.DOTALL);

    /** Scripted meal draft (mezo-78rn): {@code [fake-meal:{json}]} payload is returned verbatim —
     *  matched in the user text (text + multimodal paths) and in the UTF-8-decoded image bytes,
     *  so photo-only ITs drive canned JSON through the real multipart plumbing.
     *  GREEDY (unlike scrape) — the draft payload {@code {"slot":…,"items":[{…}]}} nests objects
     *  inside {@code items}, so the match must run to the LAST brace, not the first {@code }]}. */
    public static final Pattern MEAL_SENTINEL =
            Pattern.compile("\\[fake-meal:(\\{.*})]", Pattern.DOTALL);

    /** Scripted workshop turn (mezo-92pb): {@code [fake-workshop:{json}]} payload returned verbatim. */
    private static final Pattern WORKSHOP_SENTINEL =
            Pattern.compile("\\[fake-workshop:(\\{.*})]", Pattern.DOTALL);

    /** Scripted recipe breakdown prose (mezo-bw3y): {@code [fake-recipe-fit:{json}]} planted in the
     *  RECIPE NAME (it appears in the prompt's user message). GREEDY — the payload nests objects.
     *  No sentinel -> prompt echo -> unparseable -> the prose service degrades to the deterministic
     *  envelope, which is exactly the LLM-failure path the ITs assert. */
    public static final Pattern RECIPE_FIT_SENTINEL =
            Pattern.compile("\\[fake-recipe-fit:(\\{.*})]", Pattern.DOTALL);

    /** Scripted meal-coach verdicts (mezo-mr4n): {@code [fake-meal-coach:{json}]} planted in a MEAL
     *  TITLE (it reaches the prompt through the meal's name). GREEDY — the payload nests a
     *  {@code meals[]} array of objects, so the match must run to the LAST brace. */
    public static final Pattern MEAL_COACH_SENTINEL =
            Pattern.compile("\\[fake-meal-coach:(\\{.*})]", Pattern.DOTALL);

    /** Scripted narrative (V2.2): {@code [fake-summary:…]} payload becomes the summary answer. */
    public static final Pattern SUMMARY_SENTINEL =
            Pattern.compile("\\[fake-summary:([^\\]]*)]", Pattern.DOTALL);

    /** Scripted consolidation prose (W3.2): {@code [fake-period:…]} planted in a source narrative
     *  (a daily-summary text for the weekly rung, a weekly rung's text for the monthly one — the
     *  same "plant it in what the gather renders" channel the memoir sentinel uses). */
    public static final Pattern PERIOD_SENTINEL =
            Pattern.compile("\\[fake-period:([^\\]]*)]", Pattern.DOTALL);

    /** Scripted hypotheses (V3.2): {@code [fake-hypotheses:<json-array>]} in the weekly context. */
    public static final Pattern HYPOTHESES_SENTINEL =
            Pattern.compile("\\[fake-hypotheses:(\\[.*?\\])]", Pattern.DOTALL);

    /** Scripted critique (V3.2): {@code [fake-critique:{…}]} planted in the hypothesis title. */
    public static final Pattern CRITIQUE_SENTINEL =
            Pattern.compile("\\[fake-critique:(\\{.*?\\})]", Pattern.DOTALL);

    /** Scripted revision (V3.2): {@code [fake-revise:{…}]} planted in the hypothesis title. */
    public static final Pattern REVISE_SENTINEL =
            Pattern.compile("\\[fake-revise:(\\{.*?\\})]", Pattern.DOTALL);

    /** Mirror of CompanionMessageGenerator.MORNING_MARKER (feature/proactive) — a LITERAL, not an
     *  import: companion→proactive would be a NEW package cycle (feature_slices_are_cycle_free).
     *  Drift is caught loudly by CompanionMessageGeneratorIT (echo answer -> parse fails -> null row). */
    public static final String MORNING_MARKER_MIRROR = "REGGELI-ELIGAZITAS-FELADAT";

    /** Scripted morning message (companion-feed): {@code [fake-feed-morning:{…}]} planted via a
     *  check-in note (the snapshot renders check-in notes, so this is the established sentinel-
     *  planting channel). */
    public static final Pattern MORNING_SENTINEL =
            Pattern.compile("\\[fake-feed-morning:(\\{.*?\\})]", Pattern.DOTALL);

    /** Mirror of CompanionMessageGenerator.SLEEP_MARKER (feature/proactive) — a LITERAL, not an
     *  import: companion→proactive would be a NEW package cycle (feature_slices_are_cycle_free).
     *  Drift is caught loudly by CompanionMessageGeneratorIT (echo answer -> parse fails -> null row). */
    public static final String SLEEP_MARKER_MIRROR = "ALVAS-REAKCIO-FELADAT";

    /** Scripted sleep-reaction message (companion-feed): {@code [fake-feed-sleep:{…}]} planted via
     *  a check-in note (the snapshot renders check-in notes, so this is the established sentinel-
     *  planting channel). */
    public static final Pattern SLEEP_SENTINEL =
            Pattern.compile("\\[fake-feed-sleep:(\\{.*?\\})]", Pattern.DOTALL);

    /** Mirror of CompanionMessageGenerator.WEIGHT_MARKER (feature/proactive) — a LITERAL, not an
     *  import: same cycle rationale as {@link #SLEEP_MARKER_MIRROR}. */
    public static final String WEIGHT_MARKER_MIRROR = "SULY-REAKCIO-FELADAT";

    /** Scripted weight-reaction message (companion-feed): {@code [fake-feed-weight:{…}]} planted
     *  via a check-in note (same channel as {@link #SLEEP_SENTINEL}). */
    public static final Pattern WEIGHT_SENTINEL =
            Pattern.compile("\\[fake-feed-weight:(\\{.*?\\})]", Pattern.DOTALL);

    /** Mirror of WeeklySuggestionGenerator.WEEKLY_SUGGESTION_MARKER (feature/proactive) — a
     *  LITERAL, not an import (package-cycle rule; drift fails WeeklySuggestionGeneratorIT loudly). */
    public static final String WEEKLY_MARKER_MIRROR = "HETI-TERVJAVASLAT";

    /** Scripted weekly prose (W1): {@code [fake-weekly:…]} planted via a check-in note. */
    public static final Pattern WEEKLY_SENTINEL =
            Pattern.compile("\\[fake-weekly:([^\\]]*)]", Pattern.DOTALL);

    /** Mirror of MemoirGenerator.MEMOIR_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String MEMOIR_MARKER_MIRROR = "HETI-MEMOIR-FELADAT";

    /** Scripted memoir (W2): {@code [fake-memoir:{…}]} planted via a daily-summary narrative.
     *  GREEDY since the v2 {@code anchors:[{index,note}]} shape nests objects (mezo-uajy) —
     *  the WEEKLY_REVIEW_SENTINEL precedent. */
    public static final Pattern MEMOIR_SENTINEL =
            Pattern.compile("\\[fake-memoir:(\\{.*})]", Pattern.DOTALL);

    /** Mirror of WeeklyReviewGenerator.WEEKLY_REVIEW_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String WEEKLY_REVIEW_MARKER_MIRROR = "HETI-ELEMZES-FELADAT";

    /** Scripted weekly review (mezo-p2tr): {@code [fake-review:{…}]} planted via a MEMOIR title
     *  (the gather renders it exactly once, unlike pattern/fact/life-event labels which repeat in
     *  the numbered HORGONY-JELÖLTEK listing — see WeeklyReviewGeneratorIT's class javadoc).
     *  GREEDY — the payload {@code {"dayNotes":[…]}} nests objects, so the match must run to the
     *  LAST brace. */
    public static final Pattern WEEKLY_REVIEW_SENTINEL =
            Pattern.compile("\\[fake-review:(\\{.*})]", Pattern.DOTALL);

    /** Mirror of DiagnosisGenerator.DIAGNOSIS_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String DIAGNOSIS_MARKER_MIRROR = "FARADTSAG-DIAGNOZIS-FELADAT";

    /** Scripted diagnosis (mezo-hqfi): {@code [fake-diagnosis:{…}]} planted in ANY candidate
     *  label — unlike the weekly gather, the diagnosis payload renders every candidate EXACTLY
     *  ONCE, so there is no duplicate-occurrence hazard wherever it is planted. GREEDY for the
     *  same nested-object reason as WEEKLY_REVIEW_SENTINEL. */
    public static final Pattern DIAGNOSIS_SENTINEL =
            Pattern.compile("\\[fake-diagnosis:(\\{.*})]", Pattern.DOTALL);

    /** Mirror of CompanionMessageGenerator.WINDOW_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String HEARTBEAT_MARKER_MIRROR = "NAPKOZBENI-JEGYZET-FELADAT";

    /** Scripted heartbeat prose (H1): {@code [fake-heartbeat:…]} planted via a check-in note. */
    public static final Pattern HEARTBEAT_SENTINEL =
            Pattern.compile("\\[fake-heartbeat:([^\\]]*)]", Pattern.DOTALL);

    /** Mirror of PredictionGenerator.PREDICTION_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String PREDICTION_MARKER_MIRROR = "HETI-PREDIKCIO-FELADAT";

    /** Scripted predictions JSON (P1): {@code [fake-prediction:{…}]} planted via a check-in note.
     *  GREEDY (unlike memoir) — the payload {@code {"predictions":[{…}]}} nests objects, so the
     *  match must run to the LAST brace, not the first. */
    public static final Pattern PREDICTION_SENTINEL =
            Pattern.compile("\\[fake-prediction:(\\{.*\\})]", Pattern.DOTALL);

    /** Mirror of ExperimentProposalGenerator.EXPERIMENT_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String EXPERIMENT_MARKER_MIRROR = "N1-KISERLET-FELADAT";

    /** Scripted experiments JSON (P2): {@code [fake-experiment:{…}]} planted via a check-in note.
     *  GREEDY like predictions — the payload {@code {"experiments":[{…}]}} nests objects. */
    public static final Pattern EXPERIMENT_SENTINEL =
            Pattern.compile("\\[fake-experiment:(\\{.*\\})]", Pattern.DOTALL);

    /** Mirror of ChallengeGenerator.CHALLENGE_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String CHALLENGE_MARKER_MIRROR = "EDZES-KIHIVAS-FELADAT";

    /** Scripted challenges JSON: {@code [fake-challenge:{…}]} planted via a check-in note.
     *  GREEDY like predictions/experiments — the payload {@code {"challenges":[{…}]}} nests objects. */
    public static final Pattern CHALLENGE_SENTINEL =
            Pattern.compile("\\[fake-challenge:(\\{.*\\})]", Pattern.DOTALL);

    /** Mirror of ActivityClassifier.CLASSIFY_MARKER (feature/activity) — LITERAL, cycle rule. */
    public static final String ACTIVITY_MARKER_MIRROR = "TEVEKENYSEG-BESOROLAS-FELADAT";

    /** Scripted classification (E2): {@code [fake-activity:{…}]} planted in the entry text. */
    public static final Pattern ACTIVITY_SENTINEL =
            Pattern.compile("\\[fake-activity:(\\{.*\\}|[^\\]]*)]", Pattern.DOTALL);

    /** Mirror of QuestFlavor.FLAVOR_MARKER (feature/quest) — LITERAL, cycle rule. */
    public static final String QUEST_FLAVOR_MARKER_MIRROR = "KULDETES-IZESITES-FELADAT";

    /** Scripted flavor rewrite (E3): {@code [fake-quest-flavor:[…]]} planted in a quest title.
     *  GREEDY — the payload is a JSON array of objects. Default [] = no rewrite, so unscripted
     *  cron runs keep catalog copy deterministically. */
    public static final Pattern QUEST_FLAVOR_SENTINEL =
            Pattern.compile("\\[fake-quest-flavor:(\\[.*\\]|[^\\]]*)]", Pattern.DOTALL);

    /** Mirror of PlacementEngine.SYSTEM_PROMPT_MARKER (feature/fuel) — LITERAL, not an import,
     *  same drift-safety rationale as every other mirror here. */
    public static final String STACK_PLACEMENT_MARKER_MIRROR = "KAMRA-ELHELYEZES-FELADAT";

    /** Scripted stack placement (mezo-vx9v): {@code [fake-stack-placement:{…}]} planted in the
     *  pantry item NAME (the prompt's user message). Default = one valid minimal placement so
     *  the un-scripted happy path still resolves via the LLM branch (source="llm"). */
    public static final Pattern STACK_PLACEMENT_SENTINEL =
            Pattern.compile("\\[fake-stack-placement:(\\{.*}|[^\\]]*)]", Pattern.DOTALL);

    /** Mirror of SlotPlanEvaluationService.SYSTEM_PROMPT_MARKER (feature/fuel) — LITERAL, not an
     *  import, same drift-safety rationale as every other mirror here. */
    public static final String SLOT_PLAN_MARKER_MIRROR = "SLOT-TERV-ERTEKELES";

    /** Scripted slot-plan evaluation (mezo-7102): {@code [fake-slot-plan:{…}]} planted in a SLOT
     *  LABEL (the prompt's user message). Default = one valid minimal 'ok' verdict so the
     *  un-scripted happy path still resolves via the LLM branch. */
    public static final Pattern SLOT_PLAN_SENTINEL =
            Pattern.compile("\\[fake-slot-plan:(\\{.*}|[^\\]]*)]", Pattern.DOTALL);

    /** Scripted habit suggestions (mezo-n5e9.3): {@code [fake-habit-suggest:[…]]} planted via the
     *  request's {@code hint} (the ONLY unvalidated-echo channel left into the adapter's context —
     *  {@code chainKey} is now checked against the user's real chain keys before being echoed at
     *  all, so an unknown value never reaches the prompt text to be sentinel-matched). {@code hint}
     *  carries a contract {@code @Size(max = 200)}, so payloads must stay compact; {@link
     *  #SUGGEST_COUNT_SENTINEL} is the compact alternative for multi-item scripts. GREEDY array
     *  alternative (like {@code QUEST_FLAVOR_SENTINEL}), PLUS a raw-text fallback alternative so a
     *  deliberately broken payload (e.g. {@code [fake-habit-suggest:not-json]}) still matches and
     *  reaches the caller's JSON parser verbatim, exercising the degrade-to-empty path instead of
     *  silently falling through to the default. Default = one valid minimal suggestion so the
     *  un-scripted happy path still resolves via the LLM branch. */
    public static final Pattern SUGGEST_SENTINEL =
            Pattern.compile("\\[fake-habit-suggest:(\\[.*\\]|[^\\]]*)]", Pattern.DOTALL);

    /** Canned meso end-of-run review (mezo-meyc.3) — plain Hungarian prose, exactly the shape the
     *  real generator persists into {@code mesocycle_report.ai_eval}. A CONSTANT (not an echo) so
     *  {@code MesoReviewGeneratorIT} can assert the narrative landed verbatim. Error injection rides
     *  the shared {@link #FAIL_COMPLETE} sentinel, planted via the run TITLE. */
    public static final String MESO_REVIEW_ANSWER =
            "Ez a futam következetes volt: a heti volumen emelkedett, az alvás pedig stabil maradt. "
                    + "A stressz a futam vége felé megugrott, és ugyanott esett vissza az "
                    + "étkezés-lefedettség is. A következő futamban érdemes lehet a deload-hetet "
                    + "előbb betervezni.";

    /** Scripted meso review (mezo-meyc.3): {@code [fake-meso-review:…]} planted in the run TITLE
     *  (the payload's first line), so an IT can both script the answer AND prove the assembled
     *  prompt genuinely reached the port. */
    public static final Pattern MESO_REVIEW_SENTINEL =
            Pattern.compile("\\[fake-meso-review:([^\\]]*)]", Pattern.DOTALL);

    /** Planted in the run TITLE, returns the ASSEMBLED USER PAYLOAD verbatim — the only way an IT can
     *  assert what the generator actually sent (e.g. that the metric legend is present and precedes the
     *  data blocks). The default-branch echo idiom (§ "prompt assembly is assertable"), applied to a
     *  marker branch that otherwise answers canned text; the fake stays STATELESS — no prompt recorder.
     *  Checked BEFORE {@link #MESO_REVIEW_SENTINEL}, which needs a colon and so cannot match this. */
    public static final String MESO_REVIEW_ECHO = "[fake-meso-review-echo]";

    /** Compact companion to {@link #SUGGEST_SENTINEL}: {@code [fake-habit-suggest-count:N]}
     *  generates N valid suggestions server-side (fixed skillKey/chainKey/xp) instead of the
     *  caller spelling out N JSON objects — the only way to stay under {@code hint}'s 200-char cap
     *  for an over-cap (N > max-suggestions) script. */
    public static final Pattern SUGGEST_COUNT_SENTINEL =
            Pattern.compile("\\[fake-habit-suggest-count:(\\d+)]");

    /** W4.3 (mezo-b3pp.17): literal mirror of {@code ProfileAssembler.PROFILE_MARKER} — importing
     *  the constant would be a boundary-crossing import from the llm package into a feature
     *  subpackage's service; {@code ProfileAssemblerIT} pins the two strings together. */
    private static final String PROFILE_MARKER_MIRROR = "ROLAD-TANULTAM";

    /** Scripted graph edge structuring (W2.2): [fake-graph-edges:[…]] planted in the node title. */
    public static final Pattern GRAPH_EDGES_SENTINEL =
            Pattern.compile("\\[fake-graph-edges:(\\[.*?])]", Pattern.DOTALL);

    /** Scripted BROKEN graph edge answer (W2.2): unlike a plain missing sentinel (which degrades
     *  to the valid-but-empty {@code "[]"}), this forces {@link GraphEdgeStructurer} to genuinely
     *  fail JSON parsing — the answer has matching brackets (so the caller's bracket-slice finds a
     *  candidate substring) but invalid syntax inside them, so ITs can exercise the catch-and-log
     *  path instead of the "empty answer" path. */
    public static final String GRAPH_EDGES_BROKEN = "[fake-graph-edges-broken]";

    /** Scripted life-event extraction (W2.3): [fake-life-events:[…]] planted in the day's narrative. */
    public static final Pattern LIFE_EVENTS_SENTINEL =
            Pattern.compile("\\[fake-life-events:(\\[.*])]", Pattern.DOTALL);

    /** Scripted BROKEN life-event answer (W2.3) — matching brackets, invalid JSON inside, so ITs
     *  exercise the catch-and-log degrade instead of the "empty answer" path. */
    public static final String LIFE_EVENTS_BROKEN = "[fake-life-events-broken]";

    /** Scripted season proposal (W5.3): [fake-season:[…]] planted in a month rung's text (the
     *  gather renders every rung verbatim, so that is this pipeline's sentinel-planting channel). */
    public static final Pattern SEASON_SENTINEL =
            Pattern.compile("\\[fake-season:(\\[.*])]", Pattern.DOTALL);

    /** Scripted BROKEN season answer (W5.3) — matching brackets, invalid JSON inside, so ITs
     *  exercise the catch-and-log degrade instead of the "empty answer" path. */
    public static final String SEASON_BROKEN = "[fake-season-broken]";

    /** Call counter (W2.2): lets ITs assert the LLM-call guarantees (emptiness gate, no re-call on
     *  re-confirm) rather than only their edge-count side effects — {@code llm_log_history} is
     *  written only by the REAL {@code GeminiCompanionLlm} adapter's {@code recorded(...)} wrapper,
     *  never by this fake, so it cannot serve as the call-count oracle under {@code companion-fake}. */
    private final java.util.concurrent.atomic.AtomicInteger completeCallCount =
            new java.util.concurrent.atomic.AtomicInteger();

    public int completeCallCount() {
        return completeCallCount.get();
    }

    @Override
    public String complete(String systemPrompt, List<Turn> history, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        completeCallCount.incrementAndGet();
        // mezo-p2tr: the opening turn's userMessage is the FIXED KICKOFF_PROMPT (no room to plant a
        // sentinel there), so an IT scripts the failure via the DYNAMIC [Heti adatok] block instead
        // (e.g. a seeded weekly-review summary) — checking the system prompt too is what lets that
        // reach this same forced-failure path.
        if (userMessage.contains(FAIL_COMPLETE) || systemPrompt.contains(FAIL_COMPLETE)) {
            throw new IllegalStateException("FAKE-LLM forced complete failure");
        }
        if (systemPrompt.startsWith(FactExtractionService.EXTRACTION_MARKER)) {
            return factsAnswer(userMessage);
        }
        if (systemPrompt.startsWith(OBSERVATION_MARKER_MIRROR)) {
            Matcher obs = CHAR_OBS_SENTINEL.matcher(userMessage);
            if (obs.find()) {
                return obs.group(1);
            }
            return "[{\"text\":\"Fake megfigyelés.\",\"salience\":3,\"dimensionKeys\":[\"discipline\"]}]";
        }
        if (systemPrompt.startsWith(PROPOSAL_MARKER_MIRROR) || systemPrompt.startsWith(BOOTSTRAP_MARKER_MIRROR)
                || systemPrompt.startsWith(MONTHLY_MARKER_MIRROR)) {
            Matcher dim = PROPOSAL_DEFAULT_DIMENSION.matcher(userMessage);
            String dimensionKey = dim.find() ? dim.group(1) : "discipline";
            if (userMessage.contains(CHAR_PROPOSALS_ECHO)) {
                return "[{\"kind\":\"NEW\",\"dimensionKey\":\"" + dimensionKey + "\",\"text\":\"Fake javaslat.\","
                        + "\"confidence\":0.55,\"sensitive\":false,\"rationale\":\"" + jsonEscape(userMessage) + "\"}]";
            }
            Matcher proposals = CHAR_PROPOSALS_SENTINEL.matcher(userMessage);
            if (proposals.find()) {
                return proposals.group(1);
            }
            return "[{\"kind\":\"NEW\",\"dimensionKey\":\"" + dimensionKey + "\",\"text\":\"Fake javaslat.\","
                    + "\"confidence\":0.55,\"sensitive\":false,\"rationale\":\"Fake indoklás.\"}]";
        }
        if (systemPrompt.startsWith(SKEPTIC_MARKER_MIRROR)) {
            Matcher m = CHAR_SKEPTIC_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : skepticCannedAnswer(userMessage);
        }
        if (systemPrompt.startsWith(INTEGRATOR_MARKER_MIRROR)) {
            Matcher m = CHAR_INTEGRATOR_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : integratorCannedAnswer(userMessage);
        }
        if (systemPrompt.startsWith(PORTRAIT_MARKER_MIRROR)) {
            Matcher m = CHAR_PORTRAIT_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : CHAR_PORTRAIT_CANNED_ANSWER;
        }
        if (systemPrompt.startsWith(TurnVerdictCheck.VERDICT_MARKER)) {
            return verdictAnswer(userMessage);
        }
        if (systemPrompt.startsWith(DailySummaryService.SUMMARY_MARKER)) {
            return summaryAnswer(userMessage);
        }
        if (systemPrompt.startsWith(PeriodSummaryService.WEEKLY_MARKER)) {
            Matcher m = PERIOD_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "FAKE-HETI-KONSZOLIDACIO";
        }
        if (systemPrompt.startsWith(PeriodSummaryService.MONTHLY_MARKER)) {
            Matcher m = PERIOD_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "FAKE-HAVI-KONSZOLIDACIO";
        }
        if (systemPrompt.startsWith(MORNING_MARKER_MIRROR)) {
            Matcher m = MORNING_SENTINEL.matcher(userMessage);
            // default = valid minimal JSON so the un-scripted happy path still persists a row
            return m.find() ? m.group(1)
                    : "{\"eyebrow\":\"Fake reggeli\",\"body\":[\"FAKE-REGGELI-NARRATÍVA\"],\"refIndexes\":[]}";
        }
        if (systemPrompt.startsWith(SLEEP_MARKER_MIRROR)) {
            Matcher m = SLEEP_SENTINEL.matcher(userMessage);
            // default = valid minimal JSON so the un-scripted happy path still persists a row
            return m.find() ? m.group(1)
                    : "{\"eyebrow\":\"Fake alvás\",\"body\":[\"FAKE-ALVAS-NARRATÍVA\"],\"refIndexes\":[]}";
        }
        if (systemPrompt.startsWith(WEIGHT_MARKER_MIRROR)) {
            Matcher m = WEIGHT_SENTINEL.matcher(userMessage);
            // default = valid minimal JSON so the un-scripted happy path still persists a row
            return m.find() ? m.group(1)
                    : "{\"eyebrow\":\"Fake súly\",\"body\":[\"FAKE-SULY-NARRATÍVA\"],\"refIndexes\":[]}";
        }
        if (systemPrompt.startsWith(WEEKLY_MARKER_MIRROR)) {
            Matcher m = WEEKLY_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "FAKE-HETI-TERVJAVASLAT";
        }
        if (systemPrompt.startsWith(MEMOIR_MARKER_MIRROR)) {
            Matcher m = MEMOIR_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1)
                    : "{\"title\":\"Fake memoir\",\"body\":\"FAKE-MEMOIR-NARRATÍVA\",\"anchors\":[]}";
        }
        if (systemPrompt.startsWith(WEEKLY_REVIEW_MARKER_MIRROR)) {
            Matcher m = WEEKLY_REVIEW_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1)
                    : "{\"summary\":\"FAKE-HETI-ELEMZES\",\"dayNotes\":[],\"anchorIndexes\":[]}";
        }
        if (systemPrompt.startsWith(DIAGNOSIS_MARKER_MIRROR)) {
            Matcher m = DIAGNOSIS_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1)
                    : "{\"verdict\":\"FAKE-DIAGNOZIS\",\"confidence\":\"weak\",\"suspects\":[]}";
        }
        if (systemPrompt.startsWith(HEARTBEAT_MARKER_MIRROR)) {
            // mezo-106s: run the scripted [fake-tool:…] sentinels for their audit side
            // effect (real RecordingToolCallback + real tool refs), but do NOT echo the
            // results into the answer — the window body stays the clean scripted text.
            toolEchoes(userMessage, tools, toolContext);
            Matcher m = HEARTBEAT_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "FAKE-NAPKOZBENI-JEGYZET";
        }
        if (systemPrompt.startsWith(PREDICTION_MARKER_MIRROR)) {
            Matcher m = PREDICTION_SENTINEL.matcher(userMessage);
            // default = one valid minimal row so the un-scripted happy path still persists
            return m.find() ? m.group(1)
                    : "{\"predictions\":[{\"title\":\"Fake predikció\",\"basis\":\"FAKE-ALAP\","
                            + "\"patternIndex\":0,\"metricKey\":\"weight_trend\","
                            + "\"expectedDirection\":\"down\"}]}";
        }
        if (systemPrompt.startsWith(EXPERIMENT_MARKER_MIRROR)) {
            Matcher m = EXPERIMENT_SENTINEL.matcher(userMessage);
            // default = one valid minimal proposal so the un-scripted happy path still persists
            return m.find() ? m.group(1)
                    : "{\"experiments\":[{\"title\":\"Fake kísérlet\",\"hypothesis\":\"FAKE-HIPOTÉZIS\","
                            + "\"patternIndex\":0,\"metricKey\":\"sleep_avg\","
                            + "\"expectedDirection\":\"up\",\"totalDays\":7}]}";
        }
        if (systemPrompt.startsWith(CHALLENGE_MARKER_MIRROR)) {
            Matcher m = CHALLENGE_SENTINEL.matcher(userMessage);
            // default = one valid minimal PR proposal so the un-scripted happy path still persists
            return m.find() ? m.group(1)
                    : "{\"challenges\":[{\"exerciseIndex\":0,\"type\":\"PR\",\"targetWeightKg\":107.5,"
                            + "\"targetReps\":8,\"risk\":\"low\",\"why\":\"FAKE-INDOK\",\"glory\":\"FAKE-DICS\","
                            + "\"refIndexes\":[0],\"patternIndex\":0}]}";
        }
        if (systemPrompt.startsWith(ACTIVITY_MARKER_MIRROR)) {
            Matcher m = ACTIVITY_SENTINEL.matcher(userMessage);
            // default = valid confident classification so the un-scripted happy path categorizes
            return m.find() ? m.group(1)
                    : "{\"skillKey\":\"learning\",\"confidence\":0.9,\"xpSuggestion\":15,"
                            + "\"durationMin\":null,\"amountHuf\":null}";
        }
        if (systemPrompt.startsWith(QUEST_FLAVOR_MARKER_MIRROR)) {
            Matcher m = QUEST_FLAVOR_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "[]";
        }
        if (systemPrompt.startsWith(STACK_PLACEMENT_MARKER_MIRROR)) {
            Matcher m = STACK_PLACEMENT_SENTINEL.matcher(userMessage);
            // default = one valid minimal placement so the un-scripted happy path resolves via LLM
            return m.find() ? m.group(1)
                    : "{\"slotKey\":\"evening\",\"reasonHu\":\"Teszt indoklás.\"}";
        }
        if (systemPrompt.startsWith(SLOT_PLAN_MARKER_MIRROR)) {
            Matcher m = SLOT_PLAN_SENTINEL.matcher(userMessage);
            // default = valid minimal 'ok' verdict so the un-scripted happy path still resolves
            return m.find() ? m.group(1)
                    : "{\"verdict\":\"ok\",\"summary\":\"Teszt értékelés.\",\"suggestions\":[]}";
        }
        if (systemPrompt.startsWith(HabitSuggestLlmAdapter.SUGGEST_MARKER)) {
            Matcher count = SUGGEST_COUNT_SENTINEL.matcher(userMessage);
            if (count.find()) {
                return habitSuggestionsCount(Integer.parseInt(count.group(1)));
            }
            Matcher m = SUGGEST_SENTINEL.matcher(userMessage);
            // default = one valid minimal suggestion so the un-scripted happy path still resolves
            return m.find() ? m.group(1)
                    : "[{\"title\":\"Fake szokás\",\"why\":\"FAKE-INDOK\",\"anchorCopy\":\"teszt után\","
                            + "\"skillKey\":\"mindset\",\"xp\":10,\"chainKey\":\"MORNING\"}]";
        }
        if (systemPrompt.startsWith(MesoReviewGenerator.MESO_REVIEW_MARKER)) {
            if (userMessage.contains(MESO_REVIEW_ECHO)) {
                return userMessage;
            }
            Matcher m = MESO_REVIEW_SENTINEL.matcher(userMessage);
            // default = the canned narrative, so the un-scripted happy path still persists 'ready'
            return m.find() ? m.group(1) : MESO_REVIEW_ANSWER;
        }
        if (systemPrompt.startsWith(HypothesisPipelineService.HYPOTHESIS_MARKER)) {
            Matcher m = HYPOTHESES_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "[]";
        }
        if (systemPrompt.startsWith(HypothesisPipelineService.CRITIQUE_MARKER)) {
            // sentinels script the HYPOTHESIS under judgement, never the shared weekly context
            Matcher m = CRITIQUE_SENTINEL.matcher(userMessage.split("KONTEXTUS:", 2)[0]);
            // default GOOD critique — the keep path is the e2e baseline; script to steer
            return m.find() ? m.group(1)
                    : "{\"statistical\":0.8,\"confounders\":0.8,\"l3align\":0.8,\"actionability\":0.8,\"reasoning\":\"rendben\"}";
        }
        if (systemPrompt.startsWith(HypothesisPipelineService.REVISE_MARKER)) {
            Matcher m = REVISE_SENTINEL.matcher(userMessage.split("KONTEXTUS:", 2)[0]);
            return m.find() ? m.group(1) : "{}";
        }
        if (systemPrompt.startsWith(PROFILE_MARKER_MIRROR)) {
            return "A rövid, konkrét reggeli üzenet válik be nálad; a hosszabb elemzést délben"
                    + " olvasod el, a bőséges tipplistát pedig rendre elutasítod.";
        }
        if (systemPrompt.startsWith(GraphEdgeStructurer.STRUCTURER_MARKER)) {
            if (userMessage.contains(GRAPH_EDGES_BROKEN)) {
                // matching brackets, invalid JSON inside — exercises the catch-and-log path, not
                // the "empty answer" path a missing sentinel would take
                return "[{\"index\":0,\"kind\":\"TRIGGERS\",\"confidence\":}]";
            }
            Matcher m = GRAPH_EDGES_SENTINEL.matcher(userMessage);
            // default = no edges: the un-scripted happy path promotes the node and links nothing
            return m.find() ? m.group(1) : "[]";
        }
        if (systemPrompt.startsWith(LifeEventExtractionService.EXTRACTOR_MARKER)) {
            if (userMessage.contains(LIFE_EVENTS_BROKEN)) {
                // matching brackets, invalid JSON inside — exercises the catch-and-log path, not
                // the "empty answer" path a missing sentinel would take
                return "[{\"title\":\"Törött\",\"edges\":}]";
            }
            Matcher m = LIFE_EVENTS_SENTINEL.matcher(userMessage);
            // default = no life events: an un-scripted narrative proposes nothing
            return m.find() ? m.group(1) : "[]";
        }
        if (systemPrompt.startsWith(QuarterlyReviewService.SEASON_MARKER)) {
            if (userMessage.contains(SEASON_BROKEN)) {
                // matching brackets, invalid JSON inside — the catch-and-log path, not "empty"
                return "[{\"title\":\"Törött\",\"summary\":}]";
            }
            Matcher m = SEASON_SENTINEL.matcher(userMessage);
            // default = no seasons: an un-scripted quarter proposes nothing
            return m.find() ? m.group(1) : "[]";
        }
        // mezo-8z79: a scripted empty CHAT answer. Placed AFTER every marker branch on purpose —
        // the advisor's own verdict call carries the user message inside its payload, and it must
        // keep answering JSON rather than inheriting this emptiness.
        if (userMessage.contains(EMPTY_ANSWER)) {
            return "";
        }
        // Scrape extraction (mezo-8vum): the served product-page text embeds [fake-scrape:{json}];
        // returning the JSON verbatim runs the real fetch->strip->prompt->parse path. A page WITHOUT
        // the sentinel falls through to the prompt echo below (unparseable -> 502), as ITs assert.
        Matcher scrape = SCRAPE_SENTINEL.matcher(userMessage);
        if (scrape.find()) {
            return scrape.group(1);
        }
        // Meal draft (mezo-78rn) text-only path: a [fake-meal:{json}] planted in the user text is
        // returned verbatim; the multimodal override handles the photo path (sentinel in the bytes).
        Matcher meal = MEAL_SENTINEL.matcher(userMessage);
        if (meal.find()) {
            return meal.group(1);
        }
        // Recipe breakdown prose (mezo-bw3y): sentinel planted in the recipe name; no sentinel ->
        // prompt echo -> unparseable -> deterministic-envelope degrade (as the ITs assert).
        Matcher recipeFit = RECIPE_FIT_SENTINEL.matcher(userMessage);
        if (recipeFit.find()) {
            return recipeFit.group(1);
        }
        // Meal coach verdicts (mezo-mr4n): sentinel planted in a meal TITLE (the prompt carries the
        // name); no sentinel -> prompt echo -> unparseable -> silent degrade, which the ITs assert.
        Matcher mealCoach = MEAL_COACH_SENTINEL.matcher(userMessage);
        if (mealCoach.find()) {
            return mealCoach.group(1);
        }
        // Receptműhely turn (mezo-92pb): sentinel planted in the user message is returned verbatim;
        // no sentinel -> prompt echo -> unparseable -> 502, as the ITs assert.
        Matcher workshop = WORKSHOP_SENTINEL.matcher(userMessage);
        if (workshop.find()) {
            return workshop.group(1);
        }
        return PREFIX + " system=[" + systemPrompt + "]"
                + " history=[" + ChatHistory.render(history) + "]"
                + " user=[" + userMessage + "]"
                + String.join("", toolEchoes(userMessage, tools, toolContext));
    }

    @Override
    public String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
        Matcher meal = MEAL_SENTINEL.matcher(userMessage == null ? "" : userMessage);
        if (meal.find()) {
            return meal.group(1);
        }
        if (imageBytes != null) {
            // A "photo" in ITs is just the UTF-8 sentinel text — decode and re-match so photo-only
            // ITs drive canned JSON through the real multipart plumbing.
            Matcher img = MEAL_SENTINEL.matcher(new String(imageBytes, StandardCharsets.UTF_8));
            if (img.find()) {
                return img.group(1);
            }
        }
        return complete(systemPrompt, userMessage);
    }

    @Override
    public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
        // Photo import (mezo-d8tr): a "photo" in ITs is the UTF-8 sentinel text — decode EVERY
        // image so the two-photo path is exercised; no sentinel -> prompt echo -> the caller's
        // parse fails -> 502, which is exactly the extraction-failure path ITs assert.
        for (InlineImage img : images) {
            Matcher m = PHOTO_SENTINEL.matcher(new String(img.bytes(), StandardCharsets.UTF_8));
            if (m.find()) {
                return m.group(1);
            }
        }
        return complete(systemPrompt, userMessage);
    }

    /**
     * Voice input (mezo-at8x.4): an IT "recording" is the UTF-8 sentinel text, so the whole
     * multipart -> service -> port chain runs deterministically. No sentinel -> prompt echo,
     * which is what the "unusable model answer" path asserts.
     */
    @Override
    public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
        Matcher m = TRANSCRIPT_SENTINEL.matcher(new String(audio.bytes(), StandardCharsets.UTF_8));
        return m.find() ? m.group(1) : complete(systemPrompt, userMessage);
    }

    /** {@link #SUGGEST_COUNT_SENTINEL}: N valid, distinct, grounded suggestions — fixed skillKey
     *  ({@code mindset}) / chainKey ({@code MORNING}) / xp (10) so ITs only need to seed those two
     *  as real data; only the title varies, so the over-cap script fits comfortably under
     *  {@code hint}'s 200-char cap regardless of N. */
    private static String habitSuggestionsCount(int n) {
        StringBuilder items = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i > 0) {
                items.append(',');
            }
            items.append("{\"title\":\"Javaslat ").append(i)
                    .append("\",\"skillKey\":\"mindset\",\"xp\":10,\"chainKey\":\"MORNING\"}");
        }
        return "[" + items + "]";
    }

    /**
     * Deterministic, STATELESS verdict scripting (V1.3): the verdict payload embeds the checked
     * answer, and the echo embeds the prompts in every answer — so attempt-2 answers contain the
     * retry header, which is how {@link #VIOLATE_ONCE} "passes" the retry without the fake keeping
     * state. {@link #VIOLATE_ALWAYS} ignores the header (degraded path); {@link #VERDICT_BROKEN}
     * returns non-JSON (fail-open path).
     */
    private String verdictAnswer(String userMessage) {
        if (userMessage.contains(VERDICT_BROKEN)) {
            return "ez nem json";
        }
        if (userMessage.contains(HISTORY_SEEN_SENTINEL)) {
            return "{\"redundantQuestion\":true,\"unmarkedClaim\":false,\"reason\":\"history-seen\"}";
        }
        // mezo-q71s: a jelölt sejtés kifejezetten TISZTA ítéletet kap — ez rögzíti a politikát
        // a fake oldalán is, nem csak a valódi bíráló promptjában.
        if (userMessage.contains(MARKED_SPECULATION)) {
            return "{\"redundantQuestion\":false,\"unmarkedClaim\":false,\"reason\":\"jelölt sejtés\"}";
        }
        if (userMessage.contains(UNMARKED_CLAIM_SENTINEL)) {
            return "{\"redundantQuestion\":false,\"unmarkedClaim\":true,\"reason\":\"jelöletlen állítás\"}";
        }
        boolean retryRound = userMessage.contains(AdvisorRetry.RETRY_MARKER);
        if (userMessage.contains(VIOLATE_ALWAYS) || (userMessage.contains(VIOLATE_ONCE) && !retryRound)) {
            return "{\"redundantQuestion\":true,\"unmarkedClaim\":false,\"reason\":\"ismert tényre kérdez rá\"}";
        }
        return "{\"redundantQuestion\":false,\"unmarkedClaim\":false,\"reason\":\"\"}";
    }

    /**
     * Extraction calls answer deterministically: the {@code [fake-facts:…]} sentinel payload found
     * in the turn content becomes the "LLM" answer (a flat JSON array of fact objects, or any
     * malformed payload a test scripts), {@code []} when the turn carries no sentinel.
     */
    private String factsAnswer(String userMessage) {
        Matcher m = FACTS_SENTINEL.matcher(userMessage);
        return m.find() ? m.group(1) : "[]";
    }

    /** Scripted konzílium verdict round (mezo-1gim.5): for every {@code P<n>} the user message
     *  numbers, a deterministic KEEP verdict — index-complete, so the round's per-proposal default
     *  logic is exercised only through {@link #CHAR_SKEPTIC_SENTINEL}. */
    private static String skepticCannedAnswer(String userMessage) {
        Matcher idx = CHAR_PROPOSAL_INDEX.matcher(userMessage);
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        while (idx.find()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append("{\"index\":").append(idx.group(1))
                    .append(",\"verdict\":\"KEEP\",\"argument\":\"Fake ellenérv: elfogadható.\"}");
        }
        return sb.append(']').toString();
    }

    /** Scripted konzílium verdict round (mezo-1gim.5): for every {@code P<n>} the user message
     *  numbers, a deterministic accepted ruling at confidence 0.60 — index-complete, so the
     *  default-reject path is exercised only through {@link #CHAR_INTEGRATOR_SENTINEL}. */
    private static String integratorCannedAnswer(String userMessage) {
        Matcher idx = CHAR_PROPOSAL_INDEX.matcher(userMessage);
        StringBuilder rulings = new StringBuilder();
        boolean first = true;
        while (idx.find()) {
            if (!first) {
                rulings.append(',');
            }
            first = false;
            rulings.append("{\"index\":").append(idx.group(1))
                    .append(",\"accept\":true,\"confidence\":0.6,\"reason\":\"Fake döntés.\"}");
        }
        return "{\"rulings\":[" + rulings + "],\"chapters\":[]}";
    }

    /**
     * Summary calls (V2.2) answer deterministically: a {@code [fake-summary:…]} sentinel in the
     * digest (plant it via a check-in note) becomes the narrative verbatim; otherwise the digest
     * is echoed inside {@code ÖSSZEFOGLALÓ(…)} so ITs can assert real day-facts land in the
     * persisted narrative without any LLM.
     */
    private String summaryAnswer(String userMessage) {
        Matcher m = SUMMARY_SENTINEL.matcher(userMessage);
        return m.find() ? m.group(1) : "ÖSSZEFOGLALÓ(" + userMessage + ")";
    }

    @Override
    public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
        if (userMessage.contains(FAIL_STREAM)) {
            return Flux.concat(
                Flux.just(PREFIX),
                Flux.error(new IllegalStateException("FAKE-LLM forced stream failure")));
        }
        // mezo-8z79: a candidate with no text parts — the stream simply completes with nothing.
        if (userMessage.contains(EMPTY_ANSWER)) {
            return Flux.empty();
        }
        List<String> chunks = new ArrayList<>(List.of(
            PREFIX,
            " system=[" + systemPrompt + "]",
            " history=[" + ChatHistory.render(history) + "]",
            " user=[" + userMessage + "]"));
        chunks.addAll(toolEchoes(userMessage, tools, toolContext));
        return Flux.fromIterable(chunks);
    }

    /** Minimal JSON string escaping (backslash, quote, control chars) for {@link #CHAR_PROPOSALS_ECHO}
     *  — the echo embeds the WHOLE assembled user message as one JSON string value. */
    private static String jsonEscape(String raw) {
        return raw.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    /** Every sentinel executes the matching REAL callback; unknown names echo UNKNOWN. */
    private List<String> toolEchoes(String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext) {
        List<String> echoes = new ArrayList<>();
        Matcher m = TOOL_SENTINEL.matcher(userMessage);
        while (m.find()) {
            String name = m.group(1);
            String args = m.group(2) != null ? m.group(2) : "{}";
            String result = tools.stream()
                    .filter(cb -> cb.getToolDefinition().name().equals(name))
                    .findFirst()
                    .map(cb -> cb.call(args, new ToolContext(toolContext)))
                    .orElse("UNKNOWN");
            echoes.add(" tool:" + name + "=[" + result + "]");
        }
        return echoes;
    }
}
