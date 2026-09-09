package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminAlert;
import io.mrkuhne.mezo.api.dto.AdminAlert.SeverityEnum;
import io.mrkuhne.mezo.api.dto.AdminAlertsResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminAlertQuery;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.config.CompanionFeatureFlag;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmDailyAggregate;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmFeatureErrorRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owner status-band alert rules (mezo-kjwa): five install-wide health checks, evaluated in a
 * fixed order (cost_spike, llm_errors, memory_stuck, job_missed, tester_quiet) and rendered as
 * Hungarian, owner-facing copy.
 */
@Service
@RequiredArgsConstructor
public class AdminAlertService {

    private static final DateTimeFormatter JOB_TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final int COST_SPIKE_LOOKBACK_DAYS = 8;
    private static final int LLM_ERROR_WINDOW_HOURS = 24;

    /** {@code /admin/memory} shipped in slice 7 (mezo-l096.7, mezo-k5zy). */
    private static final String MEMORY_STUCK_LINK = "/admin/memory";

    private final AdminAlertQuery alertQuery;
    private final AdminProperties properties;
    private final LlmLogRepository llmLogRepository;
    private final AppUserRepository appUserRepository;

    /**
     * The two companion-dependent rules (memory_stuck, job_missed) need to know whether the
     * companion feature is on, without either rule's evaluation disappearing along with a
     * conditional bean — the other three rules in the same {@code alerts()} call must keep
     * running regardless of the switch. {@link CompanionFeatureFlag} is the typed binding of
     * {@code mezo.feature.companion.enabled} for exactly this "branch inside a method" case
     * (configuration_conventions.md's documented exception to the usual
     * {@code @ConditionalOnProperty}-at-the-bean-boundary rule); see its javadoc (mezo-kjwa).
     */
    private final CompanionFeatureFlag companionFeatureFlag;

    @Transactional(readOnly = true)
    public AdminAlertsResponse alerts() {
        alertQuery.applyStatementTimeout(properties.statementTimeoutSql());
        ZoneId zone = properties.reportZone();
        AdminProperties.Alerts thresholds = properties.alerts();

        List<AdminAlert> alerts = new ArrayList<>();
        costSpike(zone, thresholds).ifPresent(alerts::add);
        alerts.addAll(llmErrors(thresholds));
        if (companionFeatureFlag.enabled()) {
            memoryStuck().ifPresent(alerts::add);
            jobMissed(thresholds, zone).ifPresent(alerts::add);
        }
        testerQuiet(zone, thresholds).ifPresent(alerts::add);

        return new AdminAlertsResponse()
                .generatedAt(OffsetDateTime.now(zone))
                .alerts(alerts);
    }

    /** Yesterday vs the average of the prior 7 report-zone days (missing days count as 0). Fires
     *  when yesterday clears the absolute floor AND either the prior average is zero (first real
     *  spend day) or yesterday exceeds the average by the configured factor. */
    private Optional<AdminAlert> costSpike(ZoneId zone, AdminProperties.Alerts thresholds) {
        LocalDate today = LocalDate.now(zone);
        LocalDate yesterday = today.minusDays(1);
        LocalDate from = today.minusDays(COST_SPIKE_LOOKBACK_DAYS);
        Instant since = from.atStartOfDay(zone).toInstant();

        Map<LocalDate, BigDecimal> costByDay = llmLogRepository.aggregatePerDaySince(since, zone.getId()).stream()
                .collect(Collectors.toMap(LlmDailyAggregate::getDay,
                        row -> row.getCostUsd() == null ? BigDecimal.ZERO : row.getCostUsd()));

        double yesterdayUsd = costByDay.getOrDefault(yesterday, BigDecimal.ZERO).doubleValue();
        double priorSum = 0.0;
        for (int daysBack = 2; daysBack <= COST_SPIKE_LOOKBACK_DAYS; daysBack++) {
            priorSum += costByDay.getOrDefault(today.minusDays(daysBack), BigDecimal.ZERO).doubleValue();
        }
        double priorAvg = priorSum / (COST_SPIKE_LOOKBACK_DAYS - 1);
        double minUsd = thresholds.costSpikeMinUsd().doubleValue();
        double factor = thresholds.costSpikeFactor();

        boolean fires = yesterdayUsd >= minUsd && (priorAvg == 0.0 || yesterdayUsd > factor * priorAvg);
        if (!fires) {
            return Optional.empty();
        }
        return Optional.of(new AdminAlert()
                .key("cost_spike")
                .severity(SeverityEnum.WARN)
                .title("Tegnapi AI-költés kiugróan magas")
                .detail(String.format(Locale.ROOT, "Tegnap $%.2f ment el — a korábbi 7 nap átlaga $%.2f volt.",
                        yesterdayUsd, priorAvg))
                .link("/admin/cost?day=" + yesterday));
    }

    /** One alert per offending feature (>= min calls AND error rate over the threshold), sorted
     *  by feature for deterministic output. */
    private List<AdminAlert> llmErrors(AdminProperties.Alerts thresholds) {
        Instant since = Instant.now().minus(LLM_ERROR_WINDOW_HOURS, ChronoUnit.HOURS);
        return llmLogRepository.aggregateErrorRateByFeatureSince(since).stream()
                .filter(row -> row.getTotal() >= thresholds.llmErrorMinCalls())
                .filter(row -> row.getErrors() * 100L > (long) thresholds.llmErrorRatePct() * row.getTotal())
                .sorted(Comparator.comparing(LlmFeatureErrorRow::getFeature))
                .map(row -> {
                    int pct = (int) Math.round(row.getErrors() * 100.0 / row.getTotal());
                    return new AdminAlert()
                            .key("llm_errors")
                            .severity(SeverityEnum.BAD)
                            .title("Magas hibaarány egy AI funkciónál")
                            .subject(row.getFeature())
                            .detail("A funkció hívásainak %d%%-a hibázott az elmúlt 24 órában (%d/%d)."
                                    .formatted(pct, row.getErrors(), row.getTotal()))
                            .link("/admin/cost?feature=" + row.getFeature());
                })
                .toList();
    }

    /** Failed embeddings (BAD) take priority over merely-stale ones (WARN) — a hard failure is a
     *  worse state than a queued-but-not-yet-refreshed vector. */
    private Optional<AdminAlert> memoryStuck() {
        long failed = alertQuery.failedMemoryVectors();
        if (failed > 0) {
            return Optional.of(new AdminAlert()
                    .key("memory_stuck")
                    .severity(SeverityEnum.BAD)
                    .title("Elakadt emlék-feldolgozás")
                    .detail("%d emlék beágyazása hibára futott.".formatted(failed))
                    .link(MEMORY_STUCK_LINK));
        }
        long stale = alertQuery.staleMemoryVectors();
        if (stale > 0) {
            return Optional.of(new AdminAlert()
                    .key("memory_stuck")
                    .severity(SeverityEnum.WARN)
                    .title("Elavult emlék-beágyazások")
                    .detail("%d emlék tartalma megváltozott, de az embeddingje még nem frissült.".formatted(stale))
                    .link(MEMORY_STUCK_LINK));
        }
        return Optional.empty();
    }

    /** Silent on a fresh install (no daily_summary row has ever been written) — never a false
     *  alarm from an empty table. */
    private Optional<AdminAlert> jobMissed(AdminProperties.Alerts thresholds, ZoneId zone) {
        return alertQuery.newestDailySummaryAt().flatMap(lastAt -> {
            long hoursSince = Duration.between(lastAt, Instant.now()).toHours();
            if (hoursSince <= thresholds.jobMissedAfterHours()) {
                return Optional.empty();
            }
            String when = JOB_TIMESTAMP_FORMAT.format(lastAt.atZone(zone));
            return Optional.of(new AdminAlert()
                    .key("job_missed")
                    .severity(SeverityEnum.WARN)
                    .title("Kimaradt az éjszakai feldolgozás")
                    .detail("Az utolsó napi összegzés %s készült.".formatted(when))
                    .link("/admin"));
        });
    }

    /** One aggregated INFO alert naming every non-owner account silent for the configured number
     *  of days — never one alert per quiet tester. */
    private Optional<AdminAlert> testerQuiet(ZoneId zone, AdminProperties.Alerts thresholds) {
        Instant cutoff = LocalDate.now(zone).minusDays(thresholds.testerQuietDays()).atStartOfDay(zone).toInstant();
        List<String> quiet = appUserRepository.findAll().stream()
                .filter(user -> !user.isOwner())
                .filter(user -> user.getStatus() == AppUserEntity.UserStatus.ACTIVE)
                // lastSeenAt == null (never logged in) is deliberately excluded — that account
                // never had a "was here" moment to go quiet FROM, so it is not a quiet tester.
                .filter(user -> user.getLastSeenAt() != null && user.getLastSeenAt().isBefore(cutoff))
                .map(AppUserEntity::getName)
                .sorted()
                .toList();
        if (quiet.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new AdminAlert()
                .key("tester_quiet")
                .severity(SeverityEnum.INFO)
                .title("Csendes tesztelők")
                .detail("Ők %d+ napja nem jártak itt: %s.".formatted(thresholds.testerQuietDays(), String.join(", ", quiet)))
                .link("/admin/users?filter=quiet"));
    }
}
