package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import io.mrkuhne.mezo.feature.character.entity.RunDetectorKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunExpertKeysEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Karakter S9 Gépterem honesty spine (spec §3, mezo-1gim.14): one {@code character_run} row
 * per pipeline execution, written by all four Karakter pipelines (nightly observation pass,
 * weekly konzílium, monthly deep read, bootstrap konzílium) — INCLUDING a quiet run that produced
 * nothing, so a night the pipeline processed but found nothing renders as "csendes éjszaka · 0
 * hívás" rather than being indistinguishable from a night the pipeline never ran at all (no row).
 *
 * <p>Bean gated on {@link FeaturesConfiguration#CHARACTER_SWITCH} ONLY — this writer makes no LLM
 * call, so it must not additionally require the companion switch the pipelines themselves need.
 *
 * <p>{@link #record} is idempotent per {@code (created_by, kind, day)} (an existing live row for
 * the triple is a no-op — the DB partial unique index {@code uq_character_run_created_by_kind_day}
 * is the race-safety backstop, the same idiom {@code uq_character_conference_weekly} established
 * for {@code character_conference}) and NEVER throws into the caller: it runs in its OWN
 * {@code REQUIRES_NEW} transaction and {@code saveAndFlush}es so a constraint violation surfaces
 * and is caught HERE, inside {@code record}'s own transaction — catching it in the CALLER's
 * transaction would be too late, since Postgres aborts the whole surrounding transaction the
 * moment a statement inside it violates a constraint, which would silently poison the host
 * pipeline's own writes. Every call site additionally wraps its own {@code record} call in a
 * try/catch (the {@code DailySummaryJob} per-unit isolation idiom) as defense in depth.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterRunLog {

    private final CharacterRunRepository runRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID owner, String kind, LocalDate day, int observationCount, int callCount,
                        List<String> detectorKeys, List<String> expertKeys, UUID conferenceId) {
        try {
            Optional<CharacterRunEntity> existing = runRepository.findByCreatedByAndKindAndDay(owner, kind, day);
            if (existing.isPresent()) {
                return; // idempotent: a live row already logs this run
            }

            CharacterRunEntity entity = new CharacterRunEntity();
            entity.setCreatedBy(owner);
            entity.setKind(kind);
            entity.setDay(day);
            entity.setObservationCount(observationCount);
            entity.setCallCount(callCount);
            entity.setDetectorKeys(new RunDetectorKeysEnvelope(detectorKeys == null ? List.of() : List.copyOf(detectorKeys)));
            entity.setExpertKeys(new RunExpertKeysEnvelope(expertKeys == null ? List.of() : List.copyOf(expertKeys)));
            entity.setConferenceId(conferenceId);
            entity.setGeneratedAt(Instant.now());
            runRepository.saveAndFlush(entity);
        } catch (Exception e) {
            log.warn("Character run-log write failed for owner {} kind {} day {} — pipeline continues without it",
                    owner, kind, day, e);
        }
    }
}
