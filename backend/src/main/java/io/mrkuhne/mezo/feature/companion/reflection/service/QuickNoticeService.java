package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.QuickNoticePreScreen.Trigger;
import io.mrkuhne.mezo.feature.companion.reflection.service.TestPlanValidator.RawTestPlan;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternEventAppender;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Reflexió S4 (mezo-eq85.4) Step 3: the SAME-DAY half of the loop. The nightly pass tests
 * hypotheses against numbers; this one runs the moment a journal/gratitude entry produced a text
 * signal and asks — cheaply, and only when {@link QuickNoticePreScreen} says the signal is worth
 * it — whether Mezo has something to say about it right now.
 *
 * <p><b>What the model may and may not write (spec §1, non-negotiable).</b> The answer supplies an
 * {@code observation} EVENT's prose and, at most, a {@code proposed} row carrying a falsifiable
 * test plan. {@code status}, {@code belief}, {@code evidence_hits/misses} are never touched here —
 * a quick notice is Mezo noticing something, not Mezo deciding something. The plan itself still
 * goes through {@link TestPlanValidator}, so a series the user has no data for can never become a
 * row.
 *
 * <p><b>Why {@code REQUIRES_NEW}</b> (the S3 review finding, made explicit). The only caller is
 * {@link TextSignalListener}, from an {@code @Async @TransactionalEventListener(AFTER_COMMIT)}
 * handler — a separate thread, after the journal write already committed, with
 * {@code TextSignalService.record}'s own transaction closed too, so there is in fact no ambient
 * transaction to join today. Under the default {@code REQUIRED} that would be safe *by accident*:
 * the moment anything transactional calls this, a failure here would mark the CALLER's transaction
 * rollback-only and its {@code catch} would be defeated by an {@code UnexpectedRollbackException}
 * at commit — the user losing a journal entry over a failed notice. {@code REQUIRES_NEW} costs
 * nothing when there is no outer transaction and makes the fail-soft contract a property of THIS
 * bean instead of a property of its callers ({@link ReflectionReplyRecorder} precedent). It works
 * because the call crosses the Spring proxy from another bean.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class QuickNoticeService {

    /** Prompt marker the fake LLM keys its deterministic answer on. */
    public static final String NOTICE_MARKER = "GYORS-ÉSZREVÉTEL";

    /** How far back the pre-screen's "new person" / "topic streak" windows reach. */
    private static final int LOOKBACK_DAYS = 7;

    /** Every quick-notice row is a TRIGGER: something in today's text may drive something else. */
    private static final String CATEGORY = "trigger";
    private static final String CATEGORY_LABEL = "Trigger";
    private static final int MAX_TITLE_CHARS = 200;

    private static final String NOTICE_PROMPT = NOTICE_MARKER + """
            . {{NÉV}} épp most írt valamit, és ez a szöveg megüt egy szálat. Mondd el egy-két
            mondatban, Mezo hangján, TEGEZŐ formában, mit vettél észre — konkrétan arra építve, ami
            a szövegben és a lenti kontextusban szerepel, semmi általánosságot. Tegyél fel EGY rövid
            kérdést is. Ha egy MÉRHETŐ, megcáfolható sejtés fogalmazódik meg benned, add meg a
            hozzá tartozó teszt-tervet is: két KÜLÖNBÖZŐ sorozat, 0..3 napos csúszás, és az irány,
            amit vársz; ha nincs ilyen, a newTestPlan legyen null. Ha egy már NYITOTT sejtésről van
            szó, add vissza annak a hypothesisKey-ét. Válaszolj KIZÁRÓLAG JSON-nal:
            {"text":"...","question":"...","hypothesisKey":"ref-…|null","newTestPlan":{"seriesA":"...","seriesB":"...","lagDays":0,"expectedDirection":"positive|negative"}|null,"evidenceRefs":["journal_entry:<uuid>"]}
            ELÉRHETŐ SOROZATOK: %s""";

    /** The answer shape — every field is suspect until validated. */
    record NoticeAnswer(String text, String question, String hypothesisKey,
                        RawTestPlan newTestPlan, List<String> evidenceRefs) {
    }

    private final ReflectionProperties reflectionProperties;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    private final QuickNoticePreScreen preScreen;
    private final ObservationBudget observationBudget;
    private final ObservationOwnerLock observationOwnerLock;
    private final TestPlanValidator testPlanValidator;
    private final ReflectionMemoryGateway reflectionMemoryGateway;
    private final TextSignalRepository textSignalRepository;
    private final TextSignalSeriesService textSignalSeriesService;
    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final PatternEventAppender patternEventAppender;
    private final AppNotificationEmitter appNotificationEmitter;
    /** Journal REPOSITORIES only — the companion slice may not import journal SERVICES (ArchUnit). */
    private final JournalEntryRepository journalEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onSignal(UUID userId, UUID signalId) {
        TextSignalEntity signal = textSignalRepository
                .findByIdAndCreatedByAndDeletedFalse(signalId, userId).orElse(null);
        if (signal == null) {
            return;
        }
        List<PatternEntity> open = openRows(userId);
        Optional<Trigger> screened = preScreen.screen(signal, open, lastSevenDays(userId, signal));
        if (screened.isEmpty()) {
            // INFO, not DEBUG (mezo-5543y): this is the pipeline's most common exit and it was
            // invisible in production, where the whole diagnosis had to be reconstructed from the
            // ABSENCE of log lines. It fires at most once per journal/gratitude entry.
            log.info("Signal {} of user {} is not salient enough for a quick notice", signalId, userId);
            return;
        }
        Trigger trigger = screened.get();
        String entryText = sourceText(signal);
        NoticeAnswer answer = ask(userId, entryText, trigger, open);
        if (answer == null || answer.text() == null || answer.text().isBlank()) {
            return;
        }
        List<String> evidenceRefs = evidenceRefs(signal, answer);
        // Asked BEFORE the target is resolved because the holding-row fallback below depends on the
        // answer: a row exists to carry a card the user can SEE, so an over-budget notice must not
        // create one. Moving the read earlier is safe — it is a pure count of today's surfaced
        // events, and nothing between here and the append writes one.
        observationOwnerLock.lock(userId);
        boolean surfaced = observationBudget.allows(userId, Instant.now());
        Resolution resolved = resolveTarget(userId, answer, trigger, open, evidenceRefs);
        PatternEntity target = resolved.row() != null
                ? resolved.row()
                : holdingRow(userId, answer, evidenceRefs, resolved, surfaced);
        if (target == null) {
            log.info("Quick notice for user {} had no row to hang on — dropped ({})", userId,
                    resolved.settledGround() ? "the claim is already settled"
                            : surfaced ? "no row and no test plan" : "over budget");
            return;
        }
        PatternEventEntity event = patternEventAppender.append(userId, target.getId(),
                PatternEventEntity.KIND_OBSERVATION,
                PatternEventPayloadEnvelope.observation(observationText(answer), evidenceRefs, surfaced));
        // Collecting is unconditional, PUSHING is switchable. The event above is written and
        // marked `surfaced` either way — the feed has its content regardless. `notice.push-enabled`
        // shipped false through S4's silent launch (mezo-eq85.4) because this notification
        // deep-links into the Észrevételek tab; that tab landed in mezo-eq85.5 and the flag now
        // ships TRUE. The switch stays, so the push can be turned off again without a code change.
        if (surfaced && reflectionProperties.notice().pushEnabled()) {
            appNotificationEmitter.emit(userId, AppNotificationKind.OBSERVATION_NEW,
                    "Mezo észrevett valamit", answer.text(),
                    AppNotificationKind.OBSERVATION_NEW.deeplink(), target.getId(),
                    "observation_new:" + event.getId());
        }
    }

    /** The rows the engine is still testing — a {@code statistical} row's plan is the nightly job's. */
    private List<PatternEntity> openRows(UUID userId) {
        return patternRepository
                .findByCreatedByAndStatusInAndDeletedFalse(userId,
                        Set.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING))
                .stream()
                .filter(p -> !PatternEntity.KIND_STATISTICAL.equals(p.getKind()))
                .toList();
    }

    /**
     * The window the pre-screen counts over, WITHOUT the signal that triggered this run: its
     * "third mention" rule counts PRIOR mentions, and an edited entry must not count twice, so the
     * whole source (every version of it) is excluded, not just this row.
     */
    private List<TextSignalEntity> lastSevenDays(UUID userId, TextSignalEntity signal) {
        LocalDate day = signal.getOccurredOn();
        String ownSource = signal.getSourceKind() + ':' + signal.getSourceId();
        return textSignalSeriesService.newestPerSource(userId, day.minusDays(LOOKBACK_DAYS), day)
                .stream()
                .filter(s -> !ownSource.equals(s.getSourceKind() + ':' + s.getSourceId()))
                .toList();
    }

    /** The text the signal was extracted from; "" for a chat day (its turns are not one row). */
    private String sourceText(TextSignalEntity signal) {
        return switch (signal.getSourceKind()) {
            case TextSignalEntity.SOURCE_JOURNAL -> journalEntryRepository.findById(signal.getSourceId())
                    .map(e -> e.getText()).orElse("");
            case TextSignalEntity.SOURCE_GRATITUDE -> gratitudeEntryRepository.findById(signal.getSourceId())
                    .map(e -> e.getText()).orElse("");
            default -> "";
        };
    }

    /** One cheap-tier call; any failure or unparseable answer means NO notice, never an exception. */
    private NoticeAnswer ask(UUID userId, String entryText, Trigger trigger, List<PatternEntity> open) {
        String raw;
        try {
            String prompt = promptPersona.render(userId, NOTICE_PROMPT.formatted(
                    String.join(", ", testPlanValidator.availableSeries(userId))));
            String payload = payload(userId, entryText, trigger, open);
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_reflection", "quick_notice", null, null),
                    () -> companionLlm.complete(prompt, payload));
        } catch (Exception e) {
            log.warn("Quick notice LLM call failed for user {}", userId, e);
            return null;
        }
        return parse(raw);
    }

    /**
     * Defensive parse, mirroring {@link TextSignalExtractor#parse}: {@code raw} may be {@code null}
     * (an empty/absent generation — {@code CompanionLlm} implementations may return null for a
     * zero-text candidate), blank, or garbage — none of those may ever throw out of this stage.
     */
    private NoticeAnswer parse(String raw) {
        if (raw == null) {
            return null;
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1),
                    new TypeReference<NoticeAnswer>() {});
        } catch (Exception e) {
            // NEVER log `raw` in full: the model's answer mirrors the user's own journal entry,
            // names included. Length + a short prefix is enough to tell "empty", "prose" and
            // "truncated JSON" apart, which is all this branch has to diagnose.
            log.warn("Quick notice answer was not parseable JSON — dropping ({} chars, starts with '{}')",
                    raw.length(), raw.substring(0, Math.min(40, raw.length())), e);
            return null;
        }
    }

    private String payload(UUID userId, String entryText, Trigger trigger, List<PatternEntity> open) {
        StringBuilder out = new StringBuilder("A MAI SZÖVEG:\n").append(entryText);
        out.append("\n\nMIÉRT NÉZEK RÁ: ").append(trigger.kind());
        if (trigger.person() != null) {
            out.append(" (").append(trigger.person()).append(')');
        }
        if (trigger.topic() != null) {
            out.append(" (").append(trigger.topic()).append(')');
        }
        String touched = touchedRows(userId, trigger, open);
        if (!touched.isBlank()) {
            out.append("\n\nÉRINTETT NYITOTT SEJTÉSEK:\n").append(touched);
        }
        String memories = reflectionMemoryGateway.contextFor(userId, entryText, false);
        if (!memories.isBlank()) {
            out.append("\n\n").append(memories);
        }
        return out.toString();
    }

    /** {@code title · status · hits/misses · the user's own last words about it}. */
    private String touchedRows(UUID userId, Trigger trigger, List<PatternEntity> open) {
        StringBuilder out = new StringBuilder();
        for (PatternEntity row : open) {
            if (!trigger.patternIds().contains(row.getId())) {
                continue;
            }
            out.append("- ").append(row.getTitle())
                    .append(" · ").append(row.getStatus())
                    .append(" · ").append(row.getEvidenceHits()).append(" bejött / ")
                    .append(row.getEvidenceMisses()).append(" nem")
                    .append(" · kulcs: ").append(row.getHypothesisKey());
            lastReplyText(userId, row.getId())
                    .ifPresent(text -> out.append(" · a te szavaiddal: „").append(text).append('”'));
            out.append('\n');
        }
        return out.toString();
    }

    private Optional<String> lastReplyText(UUID userId, UUID patternId) {
        return patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, patternId, PatternEventEntity.KIND_USER_REPLY)
                .map(e -> e.getPayload().text())
                .filter(text -> text != null && !text.isBlank());
    }

    /**
     * The signal's own source is ALWAYS the first reference — code decides where the notice came
     * from, the model may only add to it (and an empty {@code evidenceRefs} is the fake's default,
     * so this is what keeps the chip honest either way).
     */
    private List<String> evidenceRefs(TextSignalEntity signal, NoticeAnswer answer) {
        Set<String> refs = new LinkedHashSet<>();
        refs.add(signal.getSourceKind() + ":" + signal.getSourceId());
        if (answer.evidenceRefs() != null) {
            answer.evidenceRefs().stream()
                    .filter(ref -> ref != null && !ref.isBlank())
                    .forEach(refs::add);
        }
        return List.copyOf(refs);
    }

    /** Text and question live in ONE payload field, split on the last newline by the feed (Step 4). */
    private String observationText(NoticeAnswer answer) {
        return answer.question() == null || answer.question().isBlank()
                ? answer.text()
                : answer.text() + "\n" + answer.question();
    }

    /**
     * Where a notice may hang, and — when nowhere — WHY, because the two misses are not the same
     * thing (mezo-5543y).
     *
     * <p>{@code settledGround} means the model's own claim resolved onto a row somebody already
     * judged ({@code refuted}/{@code rejected}/{@code confirmed}/{@code dormant}), by naming its
     * key or by proposing the test plan that derives it. Re-raising it — on that row OR on a fresh
     * one — would quietly reopen a verdict nobody revisited, so such a notice is dropped outright.
     * A miss with {@code settledGround == false} is the opposite situation: nothing in the account
     * speaks to this observation at all, which is exactly the cold start the holding row exists for.
     */
    private record Resolution(PatternEntity row, boolean settledGround) {

        static Resolution on(PatternEntity row) {
            return new Resolution(row, false);
        }

        static final Resolution SETTLED = new Resolution(null, true);
        static final Resolution NOTHING = new Resolution(null, false);
    }

    /** Named open row → new validated-plan row → the first touched row → nothing. */
    private Resolution resolveTarget(UUID userId, NoticeAnswer answer, Trigger trigger,
                                     List<PatternEntity> open, List<String> evidenceRefs) {
        // Set by either branch below when the model's claim landed on a row somebody already
        // judged. It never short-circuits: a real open target still wins, and the flag is only
        // consulted when the whole chain came up empty (see Resolution).
        boolean settledGround = false;
        if (answer.hypothesisKey() != null && !answer.hypothesisKey().isBlank()) {
            // Restricted to the user's OPEN rows (the same `open` set the pre-screen already
            // loaded: proposed|monitoring, non-statistical) — NOT intersected with
            // trigger.patternIds(), so the model may still name a related-but-untouched open row.
            // A key naming a `refuted`/`confirmed` row (a judgement already made) does not match
            // here and falls through to the next resolution step instead of resurfacing it.
            String key = answer.hypothesisKey().trim();
            Optional<PatternEntity> named = open.stream()
                    .filter(row -> key.equals(row.getHypothesisKey()))
                    .findFirst();
            if (named.isPresent()) {
                return Resolution.on(named.get());
            }
            // Not open, but the key EXISTS ⇒ the model pointed at a settled judgement.
            settledGround = patternRepository
                    .findByCreatedByAndHypothesisKeyAndDeletedFalse(userId, key).isPresent();
        }
        if (answer.newTestPlan() != null) {
            Optional<TestPlanEnvelope> plan = testPlanValidator.validate(userId, answer.newTestPlan());
            if (plan.isPresent()) {
                PatternEntity planned = existingOrNewRow(userId, plan.get(), answer, evidenceRefs);
                if (planned != null) {
                    return Resolution.on(planned);
                }
                // `existingOrNewRow` returns null for exactly one reason: the plan's own key is
                // held by a settled (or foreign-kind) row — the same verdict, re-proposed.
                settledGround = true;
            }
        }
        return open.stream().filter(row -> trigger.patternIds().contains(row.getId())).findFirst()
                .map(Resolution::on)
                .orElse(settledGround ? Resolution.SETTLED : Resolution.NOTHING);
    }

    /**
     * mezo-5543y — the cold start's way out. A brand-new account has no rows at all, so
     * {@code TOUCHES_OPEN} cannot fire and there is nothing to hang a notice on; if the model also
     * proposes no test plan, every observation used to be dropped and the Észrevételek tab stayed
     * empty for ever. This row is what carries such an observation instead.
     *
     * <p><b>It deliberately carries no test plan and no {@code hypothesisKey}.</b> Mezo noticed
     * something it cannot measure, and the row says exactly that: the nightly evaluation skips
     * plan-less rows, {@code ObservationFeedService} keeps them out of the {@code watching} group,
     * the pre-screen's {@code TOUCHES_OPEN} ignores them, and {@code ObservationSourceIcon} already
     * renders a plan-less row as Mezo's own voice. A null key is what keeps it un-addressable — a
     * model may not name it for revision, and (the partial unique index on
     * {@code (created_by, hypothesis_key)} ignoring nulls) several may coexist.
     *
     * <p>Returns {@code null} when the notice will not be SURFACED: a row exists to carry a card
     * the user can see, and one per invisible card would litter the Minták screen for ever.
     */
    private PatternEntity holdingRow(UUID userId, NoticeAnswer answer, List<String> evidenceRefs,
                                     Resolution resolved, boolean surfaced) {
        if (resolved.settledGround() || !surfaced) {
            return null;
        }
        PatternEntity row = new PatternEntity();
        row.setCreatedBy(userId);
        row.setKind(PatternEntity.KIND_REFLECTION);
        // `pair_key` is NOT NULL and is only an upsert identity for catalog rows; a holding row has
        // no pair, so its own id stands in — unique by construction, and it matches nothing.
        row.setPairKey("note-" + UUID.randomUUID());
        row.setHypothesisKey(null);
        row.setTestPlan(null);
        row.setOrigin(PatternEntity.ORIGIN_QUICK_NOTICE);
        row.setStatus(PatternEntity.STATUS_PROPOSED);
        row.setCategory(CATEGORY);
        row.setCategoryLabel(CATEGORY_LABEL);
        row.setTitle(firstSentence(answer.text()));
        row.setMechanism(answer.text());
        row.setEvidence(new PatternEvidenceEnvelope(new ArrayList<>(evidenceRefs)));
        // timestamptz stores micros and ROUNDS nanos — truncate so the re-read row equals this one
        row.setLastDetectedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return patternRepository.saveAndFlush(row);
    }

    /**
     * The plan's key IS the identity — a re-proposal of the same test reuses the existing row.
     *
     * <p><b>But only an OPEN, reflection-owned one</b>, the same guard the {@code hypothesisKey}
     * branch applies (whole-branch review finding): a re-proposed plan whose key happens to match a
     * row the engine or the user already SETTLED ({@code refuted}/{@code rejected}/
     * {@code confirmed}/{@code dormant}) must not get a fresh {@code observation} hung on it — the
     * feed would render that settled row as a {@code fresh} card and quietly reopen a judgement
     * nobody revisited. A {@code statistical} catalog row is excluded for the same reason it is
     * excluded everywhere else in Reflexió: its lifecycle belongs to the nightly Pearson job.
     *
     * <p>Returns {@code null} in that case rather than creating a duplicate row, because
     * {@code uq_pattern_created_by_hypothesis_key} (partial unique index on
     * {@code (created_by, hypothesis_key) where is_deleted = false}) forbids a second LIVE row with
     * the same key — creating one would be a constraint violation, not a fallback. The caller then
     * continues down the brief's resolution order to the first touched open row, and drops the
     * notice if there is none.
     */
    private PatternEntity existingOrNewRow(UUID userId, TestPlanEnvelope plan, NoticeAnswer answer,
                                           List<String> evidenceRefs) {
        String key = TestPlanEnvelope.key(plan);
        Optional<PatternEntity> existing = patternRepository
                .findByCreatedByAndHypothesisKeyAndDeletedFalse(userId, key);
        if (existing.isPresent()) {
            PatternEntity row = existing.get();
            boolean stillOpen = PatternEntity.STATUS_PROPOSED.equals(row.getStatus())
                    || PatternEntity.STATUS_MONITORING.equals(row.getStatus());
            return stillOpen && row.isReflectionOwned() ? row : null;
        }
        PatternEntity row = new PatternEntity();
        row.setCreatedBy(userId);
        row.setKind(PatternEntity.KIND_REFLECTION);
        row.setPairKey(key);
        row.setHypothesisKey(key);
        row.setTestPlan(plan);
        row.setOrigin(PatternEntity.ORIGIN_QUICK_NOTICE);
        row.setStatus(PatternEntity.STATUS_PROPOSED);
        row.setCategory(CATEGORY);
        row.setCategoryLabel(CATEGORY_LABEL);
        row.setTitle(firstSentence(answer.text()));
        row.setMechanism(answer.text());
        row.setEvidence(new PatternEvidenceEnvelope(new ArrayList<>(evidenceRefs)));
        // timestamptz stores micros and ROUNDS nanos — truncate so the re-read row equals this one
        row.setLastDetectedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return patternRepository.saveAndFlush(row);
    }

    /** The row's title is the notice's first sentence, capped at the column's 200 chars. */
    private String firstSentence(String text) {
        String trimmed = text.strip();
        int stop = trimmed.indexOf('.');
        String sentence = stop > 0 ? trimmed.substring(0, stop + 1) : trimmed;
        return sentence.length() > MAX_TITLE_CHARS
                ? sentence.substring(0, MAX_TITLE_CHARS) : sentence;
    }
}
