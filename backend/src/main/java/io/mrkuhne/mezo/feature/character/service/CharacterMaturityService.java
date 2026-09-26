package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterMaturityWeekEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterMaturityWeekRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Heti érettség-történet (csapatfal érettség-görbe, mezo-a9bo7.11): writes the per-dimension
 * weekly snapshot and serves the history the room curve draws. Deterministic — no LLM; every
 * value is {@link MaturityFormula} over the dimension's ACTIVE claims at that moment.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterMaturityService {

    private static final String ACTIVE = "ACTIVE";

    private final CharacterDimensionRepository dimensions;
    private final CharacterClaimRepository claims;
    private final CharacterMaturityWeekRepository weeks;

    /** The ISO Monday of {@code day}'s week. */
    public static LocalDate weekStart(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /**
     * Upserts {@code day}'s ISO-week row for every dimension of {@code owner} (CORE, META and
     * CHAPTER alike) — a rerun in the same week overwrites, so the last run of the week is its
     * final value. Returns the number of rows written.
     */
    @Transactional
    public int snapshot(UUID owner, LocalDate day) {
        LocalDate week = weekStart(day);
        int written = 0;
        for (CharacterDimensionEntity dim : dimensions.findByCreatedBy(owner)) {
            List<CharacterClaimEntity> active = activeClaims(owner, dim);
            CharacterMaturityWeekEntity row = weeks.findByCreatedByAndDimensionIdAndWeekStart(owner, dim.getId(), week)
                    .orElseGet(() -> {
                        var fresh = new CharacterMaturityWeekEntity();
                        fresh.setCreatedBy(owner);
                        fresh.setDimensionId(dim.getId());
                        fresh.setWeekStart(week);
                        return fresh;
                    });
            row.setMaturity(MaturityFormula.compute(active));
            row.setClaimCount((short) active.size());
            row.setMeanConfidence(MaturityFormula.meanConfidence(active));
            row.setUpdatedAt(Instant.now());
            weeks.save(row);
            written++;
        }
        return written;
    }

    private List<CharacterClaimEntity> activeClaims(UUID owner, CharacterDimensionEntity dim) {
        return claims.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dim.getId(), ACTIVE);
    }
}
