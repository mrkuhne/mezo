package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.train.MesoReviewGate;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleReportEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleReportRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * The AI half of the end-of-mesocycle report (mezo-meyc.3, S3): PURE-CODE gather (the frozen
 * deterministic report + the freshly assembled lifestyle context) → ONE SMART-tier call → the
 * narrative persisted onto {@code mesocycle_report.ai_eval}. The {@code MemoirGenerator} shape,
 * one-shot and provider-agnostic behind {@link CompanionLlm} (ADR 0008).
 *
 * <p><b>Two independent halves, in this order.</b> The context jsonb is assembled and persisted
 * FIRST, in its own transaction, and only then is the model called: a provider outage must still
 * leave the user with the deterministic lifestyle context on the report page. {@code generate} is
 * therefore NOT {@code @Transactional} — each step commits on its own, and no DB connection is held
 * across the (seconds-long) LLM round trip.
 *
 * <p><b>Idempotent by status.</b> Work happens ONLY while {@code ai_eval_status = 'pending'} — the
 * state {@code computeAndStore} leaves behind on every close and every regenerate. A {@code ready}
 * (or already {@code failed}) row is left completely untouched, including its context, so the
 * AFTER_COMMIT listener firing twice for one run can never burn a second smart-tier call or
 * overwrite a narrative the user is reading. A re-generation is requested by resetting the status,
 * which is exactly what {@code MesocycleReportService.computeAndStore} does.
 *
 * <p><b>Switch off ⇒ context only.</b> With {@code mezo.feature.meso-review.enabled=false} the
 * {@link MesoReviewGate} marker bean is absent and the method returns right after the context write:
 * the row stays {@code pending} forever, which is harmless because {@code getReport} reports
 * {@code aiEvalEnabled=false} and the FE hides the AI section instead of polling. The gate is
 * consumed via {@link ObjectProvider} rather than {@code @ConditionalOnProperty} on this class,
 * precisely so the context half keeps being written while the narrative is off.
 *
 * <p>Nothing ever escapes: every failure is swallowed into a persisted {@code failed} status. The
 * caller is an {@code @Async} listener thread — an exception there would only reach the executor's
 * default handler and the user would be left staring at {@code pending}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MesoReviewGenerator {

    /** Prompt prefix the fake dispatches on — imported (not mirrored): same {@code companion} slice. */
    public static final String MESO_REVIEW_MARKER = "[MESO_REVIEW]";

    /** Grouping axes of the cost report (mezo-2zyu) for this call site. */
    private static final String LLM_FEATURE = "meso_review";
    private static final String LLM_ENTITY_KIND = "mesocycle";

    private static final String SYSTEM_PROMPT = MESO_REVIEW_MARKER + "\n"
        + "{{NÉV}} edzés-társa vagy, és egy most lezárt mezociklus (futam) VÉGÉRTÉKELÉSÉT írod meg "
        + "magyarul, kizárólag a megadott adatokból. Számot, rekordot vagy trendet kitalálni tilos; "
        + "ahol az adat hiányzik (null), ott mondd ki, hogy nincs róla adat, és ne pótold "
        + "becsléssel. Diagnózist, gyógyszeres vagy klinikai javaslatot SOHA ne adj, és ne "
        + "minősítsd őt — a hangvétel ítélkezésmentes és mintázat-fókuszú.\n\n"
        + "A felhasználói üzenet JELMAGYARÁZAT blokkja megadja, mit mér PONTOSAN az egyes mező. "
        + "Kötelező eszerint értelmezni őket: ha egy mező kevesebbet mér, mint amit a neve sugall, "
        + "akkor a szövegben is szűkebben, minősítve fogalmazz róla — sose állíts többet, mint amit "
        + "az adat alátámaszt.\n\n"
        + "Négy szakaszban, ebben a sorrendben, sima folyó szövegként (nincs JSON, nincs "
        + "felsorolás-jelölő, nincs markdown címsor), összesen 4–8 bekezdésben:\n"
        + "1. Mit sikerült — mit vitt végig a futamban, konkrét számmal alátámasztva.\n"
        + "2. Mi akadt el — hol csúszott az adherencia, a volumen vagy az erő-progresszió.\n"
        + "3. Kereszt-domain mintázatok — hogyan mozgott együtt az alvás, az étkezés és a stressz a "
        + "teljesítménnyel; a heti bontásra hivatkozz, és a bizonytalanságot jelöld ("
        + "\"úgy tűnik\", \"lehet, hogy\"), sose állítsd oksági kapcsolatnak.\n"
        + "4. Javaslatok a következő futamra — 2–4 konkrét, a fenti mintázatokból következő lépés.";

    private final MesocycleRepository mesocycleRepository;
    private final MesocycleReportRepository reportRepository;
    private final MesoContextAssembler contextAssembler;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectProvider<MesoReviewGate> reviewGate;
    private final ObjectMapper objectMapper;
    private final PromptPersona promptPersona;

    /**
     * Assembles + persists the run's lifestyle context, then (switch permitting) generates and
     * persists the AI narrative. Owner-scoped on both the report row and the run itself, so a
     * stale/foreign event id can never read another user's data.
     */
    public void generate(UUID userId, UUID mesocycleId) {
        MesocycleReportEntity row = reportRepository
            .findByMesocycleIdAndCreatedByAndDeletedFalse(mesocycleId, userId).orElse(null);
        if (row == null) {
            log.debug("No report row for run {} — nothing to review", mesocycleId);
            return;
        }
        if (!MesocycleReportEntity.AI_EVAL_STATUS_PENDING.equals(row.getAiEvalStatus())) {
            log.debug("Meso review of run {} is already {} — skipping", mesocycleId, row.getAiEvalStatus());
            return;
        }
        MesocycleEntity run = mesocycleRepository.findById(mesocycleId)
            .filter(m -> userId.equals(m.getCreatedBy()))
            .orElse(null);
        if (run == null) {
            log.debug("Run {} is gone or not owned by {} — nothing to review", mesocycleId, userId);
            return;
        }
        try {
            LocalDate windowEnd = windowEnd(run);
            row.setContext(contextAssembler
                .assemble(userId, run.getStartDate(), windowEnd, run.getWeeks()));
            // own transaction: the context survives an LLM failure, and no connection is held
            // across the round trip below
            final MesocycleReportEntity stored = reportRepository.save(row);
            if (reviewGate.getIfAvailable() == null) {
                log.debug("meso-review switch off — context stored for run {}, AI half left pending",
                    mesocycleId);
                return;
            }
            String answer = llmCallContextHolder.runWith(
                new LlmCallContext(LLM_FEATURE, "generate", LLM_ENTITY_KIND, mesocycleId),
                () -> companionLlm.completeSmart(promptPersona.render(userId, SYSTEM_PROMPT), payload(run, windowEnd, stored)));
            if (answer == null || answer.isBlank()) {
                // An unusable answer is a degrade, not an app error (the MemoirGenerator precedent):
                // no exception to raise, just the same 'failed' the FE renders as a retry affordance.
                log.warn("Empty meso review answer for run {} — marking failed", mesocycleId);
                markFailed(mesocycleId, userId);
                return;
            }
            markReady(mesocycleId, userId, answer.strip());
        } catch (Exception e) {
            log.warn("Meso review generation failed for run {}", mesocycleId, e);
            markFailed(mesocycleId, userId);
        }
    }

    /**
     * Persists the narrative on a FRESHLY RE-READ row — the {@link #markFailed} idiom, and the reason
     * the in-flight {@code stored} entity is deliberately NOT merged here: seconds pass during the LLM
     * round trip, and a {@code regenerate} landing inside that window has already written a new
     * {@code report} jsonb. Merging the pre-call snapshot would silently revert it (and the owner's
     * {@code selfEval} with it). Only the three AI fields are touched, so whatever else moved
     * meanwhile survives.
     *
     * <p>Package-crossing visibility on purpose: {@code MesoReviewGeneratorIT} drives this directly to
     * pin the re-read behaviour, which no end-to-end test can observe (the fake LLM returns before any
     * concurrent write could be orchestrated).
     */
    public void markReady(UUID mesocycleId, UUID userId, String narrative) {
        reportRepository.findByMesocycleIdAndCreatedByAndDeletedFalse(mesocycleId, userId)
            .ifPresent(fresh -> {
                fresh.setAiEval(narrative);
                fresh.setAiEvalStatus(MesocycleReportEntity.AI_EVAL_STATUS_READY);
                fresh.setAiEvalGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
                reportRepository.save(fresh);
            });
    }

    /**
     * The failed status is persisted on its OWN read — the in-flight entity may be the very thing
     * that blew up. Swallowed too: a failure to record a failure must not escape to the executor.
     */
    private void markFailed(UUID mesocycleId, UUID userId) {
        try {
            reportRepository.findByMesocycleIdAndCreatedByAndDeletedFalse(mesocycleId, userId)
                .ifPresent(row -> {
                    row.setAiEvalStatus(MesocycleReportEntity.AI_EVAL_STATUS_FAILED);
                    reportRepository.save(row);
                });
        } catch (Exception e) {
            log.warn("Could not mark meso review of run {} failed", mesocycleId, e);
        }
    }

    /**
     * What the context's field NAMES do not say. Several of them measure less than they promise, and a
     * model handed the raw jsonb would confidently overstate all three: {@code gymRpeAvg} is
     * {@code TRAINING_RPE}, which reads sport + run RPE and NO gym data at all; the weight fields are
     * sums of consecutive-MEASURED-day deltas, so weekly weigh-ins yield null and partial coverage
     * would read as the whole run's change; and every average is over the days that have a datapoint,
     * with no denominator attached (2 of 7 nights looks identical to 7 of 7). Shipping the legend beside
     * the data is what turns those into qualified statements instead of confident wrong ones.
     */
    private static final String LEGEND = "JELMAGYARÁZAT (a mezők PONTOS jelentése — kötelező eszerint "
        + "értelmezni és minősítve fogalmazni):\n"
        + "- gymRpeAvg = a SPORT- és FUTÁS-edzések RPE-átlaga, NEM a gym-edzésekéé (gym-RPE-adat "
        + "egyáltalán nincs benne);\n"
        + "- weightDeltaKg / weightChangeKg = az egymást KÖVETŐ MÉRT napok változásainak összege — heti "
        + "(nem napi) mérlegelésnél hiányos vagy null, tehát NEM a futam teljes súlyváltozása;\n"
        + "- minden átlag KIZÁRÓLAG az adattal rendelkező napokra vonatkozik, a nap-számot nem "
        + "tartalmazza (2 mért éjszaka átlaga ugyanúgy néz ki, mint 7-é) — a mealCoverageDays / "
        + "sportSessions / runSessions darabszámok az egyetlen lefedettség-jelzők;\n"
        + "- a null azt jelenti: nincs adat. Ne pótold becsléssel, és ne olvasd nullának;\n"
        + "- késői zárásnál az utolsó heti vödör 7 napnál HOSSZABB időszakot is fedhet.";

    /**
     * PURE-CODE payload: the metric legend above, then the run's identity + window, the owner's own
     * close-time note, and the two frozen jsonb blocks verbatim. Nulls are serialized as {@code null}
     * on purpose — they ARE the "no data" signal the prompt tells the model to name rather than fill in.
     *
     * <p>The title is part of the payload because the review is about a specific named run (and it
     * is the channel {@code MesoReviewGeneratorIT} plants its fake-LLM sentinels through).
     */
    private String payload(MesocycleEntity run, LocalDate windowEnd, MesocycleReportEntity row) {
        String selfEval = row.getSelfEval() == null || row.getSelfEval().isBlank()
            ? "nincs" : row.getSelfEval();
        return LEGEND + "\n\n"
            + "FUTAM: " + run.getTitle()
            + " (" + run.getStartDate() + " – " + windowEnd + ", " + run.getWeeks() + " hét)\n"
            + "ÖNÉRTÉKELÉS: " + selfEval + "\n\n"
            + "EREDMÉNYEK (JSON):\n" + json(row.getReport()) + "\n\n"
            + "ÉLETMÓD-KONTEXTUS, HETI BONTÁS (JSON):\n" + json(row.getContext());
    }

    private String json(Object value) {
        if (value == null) {
            return "nincs adat";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Meso review payload block failed to serialize", e);
            return "nincs adat";
        }
    }

    /**
     * The context window's upper bound — the same rule {@code MesocycleReportService} freezes the
     * deterministic half against ({@code closedAt}'s local date, falling back to the planned
     * {@code endDate} for a legacy archived run that was never explicitly closed), so the numbers and
     * the context always describe the SAME span. Clamped so a malformed range cannot invert it.
     */
    private static LocalDate windowEnd(MesocycleEntity run) {
        LocalDate end = run.getClosedAt() != null
            ? run.getClosedAt().atZone(ZoneId.systemDefault()).toLocalDate()
            : run.getEndDate();
        return end.isBefore(run.getStartDate()) ? run.getStartDate() : end;
    }
}
