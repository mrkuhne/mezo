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

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    private final QuickNoticePreScreen preScreen;
    private final ObservationBudget observationBudget;
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
            log.debug("Signal {} of user {} is not salient enough for a quick notice", signalId, userId);
            return;
        }
        Trigger trigger = screened.get();
        String entryText = sourceText(signal);
        NoticeAnswer answer = ask(userId, entryText, trigger, open);
        if (answer == null || answer.text() == null || answer.text().isBlank()) {
            return;
        }
        List<String> evidenceRefs = evidenceRefs(signal, answer);
        PatternEntity target = resolveTarget(userId, answer, trigger, open, evidenceRefs);
        if (target == null) {
            log.debug("Quick notice for user {} had no row to hang on — dropped", userId);
            return;
        }
        boolean surfaced = observationBudget.allows(userId, Instant.now());
        PatternEventEntity event = patternEventAppender.append(userId, target.getId(),
                PatternEventEntity.KIND_OBSERVATION,
                PatternEventPayloadEnvelope.observation(observationText(answer), evidenceRefs, surfaced));
        if (surfaced) {
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
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1),
                    new TypeReference<NoticeAnswer>() {});
        } catch (Exception e) {
            log.warn("Quick notice answer was not parseable JSON — dropping: {}", raw, e);
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

    /** Named open row → new validated-plan row → the first touched row → nothing. */
    private PatternEntity resolveTarget(UUID userId, NoticeAnswer answer, Trigger trigger,
                                        List<PatternEntity> open, List<String> evidenceRefs) {
        if (answer.hypothesisKey() != null && !answer.hypothesisKey().isBlank()) {
            Optional<PatternEntity> named = patternRepository
                    .findByCreatedByAndHypothesisKeyAndDeletedFalse(userId, answer.hypothesisKey().trim());
            if (named.isPresent()) {
                return named.get();
            }
        }
        if (answer.newTestPlan() != null) {
            Optional<TestPlanEnvelope> plan = testPlanValidator.validate(userId, answer.newTestPlan());
            if (plan.isPresent()) {
                return existingOrNewRow(userId, plan.get(), answer, evidenceRefs);
            }
        }
        return open.stream().filter(row -> trigger.patternIds().contains(row.getId())).findFirst()
                .orElse(null);
    }

    /** The plan's key IS the identity — a re-proposal of the same test reuses the existing row. */
    private PatternEntity existingOrNewRow(UUID userId, TestPlanEnvelope plan, NoticeAnswer answer,
                                           List<String> evidenceRefs) {
        String key = TestPlanEnvelope.key(plan);
        Optional<PatternEntity> existing = patternRepository
                .findByCreatedByAndHypothesisKeyAndDeletedFalse(userId, key);
        if (existing.isPresent()) {
            return existing.get();
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
