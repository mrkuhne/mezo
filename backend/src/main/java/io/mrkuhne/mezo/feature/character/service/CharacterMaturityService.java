package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.api.dto.CharacterMaturityHistory;
import io.mrkuhne.mezo.api.dto.CharacterMaturityPoint;
import io.mrkuhne.mezo.api.dto.CharacterMaturityWeek;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterMaturityWeekEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterMaturityWeekRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
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
    private static final int MAX_WEEKS = 26;

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

    /**
     * The room curve's source: the STORED weeks of the {@code weeksBack}-week window ending with
     * {@code today}'s week (oldest first, a week without rows is simply absent), then the CURRENT
     * week computed live — so the curve's last point always equals the overview ring. A stored row
     * whose dimension no longer exists is skipped (its identity is gone with it).
     */
    @Transactional(readOnly = true)
    public CharacterMaturityHistory history(UUID owner, LocalDate today, int weeksBack) {
        if (weeksBack < 1 || weeksBack > MAX_WEEKS) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_RUN_RANGE_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
        LocalDate current = weekStart(today);
        Map<UUID, CharacterDimensionEntity> dims = new HashMap<>();
        dimensions.findByCreatedBy(owner).forEach(d -> dims.put(d.getId(), d));

        Map<LocalDate, List<CharacterMaturityPoint>> stored = new TreeMap<>();
        if (weeksBack > 1) {
            for (CharacterMaturityWeekEntity row : weeks.findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(
                    owner, current.minusWeeks(weeksBack - 1L), current.minusWeeks(1))) {
                CharacterDimensionEntity dim = dims.get(row.getDimensionId());
                if (dim != null) {
                    stored.computeIfAbsent(row.getWeekStart(), w -> new ArrayList<>())
                            .add(point(dim, row.getMaturity(), row.getClaimCount()));
                }
            }
        }
        List<CharacterMaturityWeek> out = new ArrayList<>();
        stored.forEach((week, points) -> out.add(week(week, false, points)));

        List<CharacterMaturityPoint> live = new ArrayList<>();
        for (CharacterDimensionEntity dim : dims.values()) {
            List<CharacterClaimEntity> active = activeClaims(owner, dim);
            live.add(point(dim, MaturityFormula.compute(active), (short) active.size()));
        }
        out.add(week(current, true, live));
        return CharacterMaturityHistory.builder().weeks(out).build();
    }

    private static CharacterMaturityWeek week(LocalDate weekStart, boolean live, List<CharacterMaturityPoint> points) {
        points.sort(Comparator.comparing(CharacterMaturityPoint::getKey));
        return CharacterMaturityWeek.builder().weekStart(weekStart).live(live).dimensions(points).build();
    }

    private static CharacterMaturityPoint point(CharacterDimensionEntity dim, short maturity, short claimCount) {
        return CharacterMaturityPoint.builder()
                .key(dim.getKey())
                .title(dim.getTitle())
                .expertKey(dim.getExpertKey())
                .maturity((int) maturity)
                .claimCount((int) claimCount)
                .build();
    }

    private List<CharacterClaimEntity> activeClaims(UUID owner, CharacterDimensionEntity dim) {
        return claims.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dim.getId(), ACTIVE);
    }
}
