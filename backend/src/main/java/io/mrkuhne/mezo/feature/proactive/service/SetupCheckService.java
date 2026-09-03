package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Setup checks (S3, bd mezo-d58h.3, spec 2026-09-03 §4 setup table) — the user's CONFIGURATION
 * contradicts what coaching needs. Not flags: these read configuration rather than metric series,
 * run on their own daily cron rather than the flag spine, and emit a {@code setup} card that
 * re-emits at most weekly until the configuration stops contradicting them.
 *
 * <p>PURE CODE, like {@code InterventionService}: the text is config, never an LLM call, so there
 * is nothing to tag with LlmCallContextHolder.
 *
 * <p>Checks are ordered and first-wins — a user with no sleep goal at all gets the goal card, not
 * a feasibility card computed against a goal that does not exist.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class SetupCheckService {

    public static final String CHECK_MISSING_SLEEP_GOAL = "missing_sleep_goal";
    /** Task 4 (S3) adds the plan-feasibility check behind this same entry point. */
    public static final String CHECK_PLAN_FEASIBILITY = "plan_feasibility";
    public static final String EYEBROW = "Mezo · beállítás";

    private static final String MISSING_SLEEP_GOAL_TEXT =
        "Nincs még alvás-célod beállítva, így az alvásról csak találgatni tudok. "
        + "Állítsd be a cél alvásidőt és a horgonyt (ébredés vagy lefekvés) — onnantól "
        + "az alváskárt és a terv-javaslatok a te számaidra szólnak.";

    private final SleepGoalRepository sleepGoalRepository;
    private final CompanionMessageRepository companionMessageRepository;
    private final SetupCheckProperties properties;

    /** The first check that fires for {@code userId} today, or empty when the setup is sound. */
    @Transactional
    public Optional<CompanionMessageEntity> runFor(UUID userId) {
        LocalDate today = LocalDate.now();
        if (companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                userId, today, CompanionMessageEntity.KIND_SETUP).isPresent()) {
            log.info("Setup check skipped for user {}: today's setup card already exists", userId);
            return Optional.empty();
        }
        // Read the REPOSITORY, never SleepGoalService/SleepAnchorResolver: both fall back to a
        // config-default ghost, so the missing-row condition is invisible through them.
        if (sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()) {
            return emit(userId, today, CHECK_MISSING_SLEEP_GOAL, MISSING_SLEEP_GOAL_TEXT);
        }
        return Optional.empty();
    }

    /** Writes the card unless this same check already spoke inside the re-emit window. */
    Optional<CompanionMessageEntity> emit(UUID userId, LocalDate today, String checkKey, String text) {
        if (inReEmitWindow(userId, checkKey)) {
            log.info("Setup check {} skipped for user {}: inside the re-emit window", checkKey, userId);
            return Optional.empty();
        }
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(today);
        row.setKind(CompanionMessageEntity.KIND_SETUP);
        row.setContent(new CompanionMessageEnvelope(EYEBROW, List.of(text), List.of(), null, checkKey));
        row.setGeneratedAt(Instant.now());
        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(row);
        log.info("Setup check {} delivered for user {}", checkKey, userId);
        return Optional.of(saved);
    }

    /** The same CHECK must not repeat inside its window — envelope keys of recent setup cards,
     *  filtered in memory (single-user volumes), the InterventionService cooldown idiom. */
    private boolean inReEmitWindow(UUID userId, String checkKey) {
        Instant since = Instant.now().minus(properties.reEmitHours(), ChronoUnit.HOURS);
        return companionMessageRepository
            .findByCreatedByAndKindAndGeneratedAtAfter(userId, CompanionMessageEntity.KIND_SETUP, since)
            .stream()
            .anyMatch(row -> checkKey.equals(row.getContent().setupKey()));
    }
}
