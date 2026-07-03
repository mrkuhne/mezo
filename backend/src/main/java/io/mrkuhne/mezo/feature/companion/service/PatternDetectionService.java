package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * V3.1 detection: for every catalog pair, lag-align the two per-day series over the lookback
 * window, gate on {@code min-n}, run the pure Pearson math, and UPSERT the statistical pattern
 * row by {@code (user, kind, pair_key)}. Stats refresh while a row is {@code proposed} or
 * {@code monitoring}; a user-judged {@code confirmed}/{@code rejected} row is never auto-touched
 * (V3.3 hooks confirmed-recurrence into fact reinforcement). {@code confidence} stays null —
 * honest small-n (spec §6/§8); everything rendered here is deterministic code, no LLM anywhere.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternDetectionService {

    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final CompanionProperties properties;

    /** Runs detection for one user over the finished-days window; returns pairs upserted. */
    @Transactional
    public int detect(UUID userId) {
        CompanionProperties.Patterns config = properties.patterns();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(config.lookbackDays() - 1L);
        int upserted = 0;
        for (CompanionProperties.PatternPair pair : config.pairs()) {
            try {
                if (detectPair(userId, pair, from, to, config.minN())) {
                    upserted++;
                }
            } catch (Exception e) {
                log.warn("Pattern detection failed for pair {} of user {}", pair.key(), userId, e);
            }
        }
        return upserted;
    }

    private boolean detectPair(UUID userId, CompanionProperties.PatternPair pair,
                               LocalDate from, LocalDate to, int minN) {
        Map<LocalDate, Double> seriesA = metricSeriesService.series(userId, pair.metricA(), from, to);
        if (seriesA.isEmpty()) {
            return false;
        }
        Map<LocalDate, Double> seriesB = metricSeriesService.series(userId, pair.metricB(),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        List<double[]> aligned = new ArrayList<>();
        seriesA.forEach((day, a) -> {
            Double b = seriesB.get(day.plusDays(pair.lagDays()));
            if (b != null) {
                aligned.add(new double[] {a, b});
            }
        });
        if (aligned.size() < minN) {
            return false; // below the surfacing gate — not persisted at all
        }
        double[] xs = aligned.stream().mapToDouble(v -> v[0]).toArray();
        double[] ys = aligned.stream().mapToDouble(v -> v[1]).toArray();
        var result = PearsonCorrelation.correlate(xs, ys).orElse(null);
        if (result == null) {
            return false; // degenerate (constant series) — no statistic, nothing to claim
        }
        upsert(userId, pair, result, from, to);
        return true;
    }

    private void upsert(UUID userId, CompanionProperties.PatternPair pair,
                        PearsonCorrelation.Result result, LocalDate from, LocalDate to) {
        PatternEntity pattern = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                        userId, PatternEntity.KIND_STATISTICAL, pair.key())
                .orElse(null);
        if (pattern != null && (PatternEntity.STATUS_CONFIRMED.equals(pattern.getStatus())
                || PatternEntity.STATUS_REJECTED.equals(pattern.getStatus()))) {
            return; // user-judged — frozen for the nightly job (V3.3 adds reinforcement)
        }
        if (pattern == null) {
            pattern = new PatternEntity();
            pattern.setCreatedBy(userId);
            pattern.setKind(PatternEntity.KIND_STATISTICAL);
            pattern.setPairKey(pair.key());
            pattern.setStatus(PatternEntity.STATUS_PROPOSED);
        }
        pattern.setCategory(pair.category());
        pattern.setCategoryLabel(pair.label());
        pattern.setTitle(pair.title());
        pattern.setMechanism(mechanism(pair, result));
        pattern.setEvidence(new PatternEvidenceEnvelope(evidence(result, from, to)));
        pattern.setR(BigDecimal.valueOf(result.r()).setScale(4, RoundingMode.HALF_UP));
        pattern.setN(result.n());
        pattern.setP(BigDecimal.valueOf(result.p()).setScale(6, RoundingMode.HALF_UP));
        pattern.setConfidence(null); // honest small-n — V3.2's critique fills it for hypotheses
        pattern.setLastDetectedAt(Instant.now());
        patternRepository.saveAndFlush(pattern);
    }

    /** Deterministic Hungarian description — strength + direction + the two metric labels. */
    private String mechanism(CompanionProperties.PatternPair pair, PearsonCorrelation.Result result) {
        double abs = Math.abs(result.r());
        String strength = abs >= 0.6 ? "Erős" : abs >= 0.3 ? "Közepes erősségű" : "Gyenge";
        String direction = result.r() >= 0 ? "pozitív" : "negatív";
        String lag = pair.lagDays() > 0 ? " (" + pair.lagDays() + " napos eltolással)" : "";
        return strength + " " + direction + " együttjárás a(z) " + pair.metricA().labelHu()
                + " és a(z) " + pair.metricB().labelHu() + " között" + lag
                + " az elmúlt " + properties.patterns().lookbackDays() + " napban.";
    }

    private List<String> evidence(PearsonCorrelation.Result result, LocalDate from, LocalDate to) {
        return List.of(
                String.format(Locale.ROOT, "r=%.2f", result.r()),
                "n=" + result.n() + " nap",
                String.format(Locale.ROOT, "p=%.3f", result.p()),
                from + " – " + to);
    }
}
