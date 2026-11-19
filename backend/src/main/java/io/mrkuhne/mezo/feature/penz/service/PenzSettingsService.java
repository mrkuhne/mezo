package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzMonthOverride;
import io.mrkuhne.mezo.api.dto.PenzSettingsRequest;
import io.mrkuhne.mezo.api.dto.PenzSettingsResponse;
import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import io.mrkuhne.mezo.feature.penz.entity.PenzSettingsEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzSettingsRepository;
import io.mrkuhne.mezo.feature.penz.service.engine.AllowanceSettings;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * The owner's money settings (Boop Pénz L4, mezo-r36n9.102): one live row, created with the defaults on first
 * access (native ON CONFLICT, so a concurrent first access never duplicates it). The owner's {@code timezone}
 * is also what "today" means for every Pénz rule (month over? future-dated row?). "Now" is the application
 * {@link Clock} when one is defined (tests), else the system clock.
 */
@Service
public class PenzSettingsService {

    private static final TypeReference<Map<String, PenzMonthOverride>> OVERRIDES = new TypeReference<>() {};

    private final PenzSettingsRepository repository;
    private final PenzProperties properties;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<Clock> clock;

    public PenzSettingsService(PenzSettingsRepository repository, PenzProperties properties, ObjectMapper objectMapper,
                               ObjectProvider<Clock> clock) {
        this.repository = repository;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional
    public PenzSettingsResponse get(UUID owner) {
        return toResponse(ensure(owner));
    }

    @Transactional
    public PenzSettingsResponse put(UUID owner, PenzSettingsRequest req) {
        PenzSettingsEntity row = ensure(owner);
        row.setSavingsTargetMinor(req.getSavingsTargetHufMinor());
        row.setPracticeMonthlyMinor(req.getPracticeMonthlyHufMinor());
        if (req.getWeekStart() != null) {
            row.setWeekStart(req.getWeekStart());
        }
        if (req.getEmergencyFundMonths() != null) {
            row.setEmergencyFundMonths(req.getEmergencyFundMonths());
        }
        if (req.getTimezone() != null) {
            row.setTimezone(validZone(req.getTimezone()).getId());
        }
        if (req.getMonthOverrides() != null) {
            req.getMonthOverrides().keySet().forEach(PenzMonths::requireMonth);
            row.setMonthOverrides(objectMapper.writeValueAsString(req.getMonthOverrides()));
        }
        row.setUpdatedAt(Instant.now(clock()).truncatedTo(ChronoUnit.MICROS));
        return toResponse(repository.saveAndFlush(row));
    }

    /** The owner's live settings row, created with the defaults when absent. */
    @Transactional
    public PenzSettingsEntity ensure(UUID owner) {
        return repository.findByCreatedByAndDeletedFalse(owner).orElseGet(() -> {
            repository.insertIfAbsent(owner, properties.practiceMonthlyDefaultMinor());
            return repository.findByCreatedByAndDeletedFalse(owner).orElseThrow(); // just ensured
        });
    }

    /** The owner's today, in the owner's money timezone. */
    @Transactional
    public LocalDate today(UUID owner) {
        return LocalDate.now(clock().withZone(validZoneOrDefault(ensure(owner).getTimezone())));
    }

    /**
     * What the allowance engine reads from the owner's settings: the monthly savings target, the Gyakorlás cap
     * ({@code practice_monthly_minor}) and every month's own savings target from {@code month_overrides}.
     */
    @Transactional
    public AllowanceSettings allowanceSettings(UUID owner) {
        PenzSettingsEntity e = ensure(owner);
        Map<YearMonth, Long> savingsOverrides = new HashMap<>();
        overrides(e).forEach((month, o) -> {
            if (o.getSavingsTargetHufMinor() != null) {
                savingsOverrides.put(YearMonth.parse(month), o.getSavingsTargetHufMinor());
            }
        });
        return new AllowanceSettings(e.getSavingsTargetMinor(), e.getPracticeMonthlyMinor(), savingsOverrides);
    }

    private Map<String, PenzMonthOverride> overrides(PenzSettingsEntity e) {
        return e.getMonthOverrides() == null || e.getMonthOverrides().isBlank()
            ? Map.of() : objectMapper.readValue(e.getMonthOverrides(), OVERRIDES);
    }

    private PenzSettingsResponse toResponse(PenzSettingsEntity e) {
        Map<String, PenzMonthOverride> overrides = overrides(e);
        return new PenzSettingsResponse()
            .savingsTargetHufMinor(e.getSavingsTargetMinor())
            .practiceMonthlyHufMinor(e.getPracticeMonthlyMinor())
            .weekStart(PenzSettingsResponse.WeekStartEnum.fromValue(e.getWeekStart()))
            .emergencyFundMonths(e.getEmergencyFundMonths())
            .timezone(e.getTimezone())
            .monthOverrides(new HashMap<>(overrides));
    }

    private static ZoneId validZone(String zone) {
        try {
            return ZoneId.of(zone);
        } catch (DateTimeException ex) {
            throw PenzErrors.field("timezone");
        }
    }

    private static ZoneId validZoneOrDefault(String zone) {
        try {
            return ZoneId.of(zone);
        } catch (DateTimeException ex) {
            return ZoneId.of("Europe/Budapest");
        }
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }
}
