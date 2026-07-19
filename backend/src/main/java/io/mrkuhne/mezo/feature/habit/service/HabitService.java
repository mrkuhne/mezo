package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.api.dto.HabitStrength;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.HabitCatalog.HabitDef;
import io.mrkuhne.mezo.feature.habit.config.HabitProperties;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.mapper.HabitMapper;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.habit.HabitSignal;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Habit day lifecycle (bd mezo-d1jb, ADR 0010): a day materializes lazily on the first today-read,
 * derived habits complete off honest signals (evaluated intraday + at closure, awarded once through
 * progression atomically with the status flip), and past pending days close quietly — kept if the
 * signal fired, else missed (no failure ceremony). Manual habits are user-checked/unchecked (same
 * day only); uncheck reverts the XP so a re-check can re-award. Gated {@code HABIT_SWITCH}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitService {

    private final HabitDayRepository repository;
    private final HabitCatalog catalog;
    private final HabitEvaluator evaluator;
    private final HabitMapper mapper;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final HabitProperties properties;

    @Transactional
    public HabitDayResponse getDay(UUID userId, LocalDate date) {
        List<HabitDayEntity> rows = repository.findByCreatedByAndHabitDate(userId, date);
        if (rows.isEmpty() && date.equals(LocalDate.now())) {
            rows = ensureRows(userId, date);
        }
        List<LevelUpResult> levelUps = new ArrayList<>();
        if (date.equals(LocalDate.now())) {
            closePast(userId, date);
            levelUps.addAll(evaluateIntraday(rows));
        }
        Map<String, Integer> strengths = strengthByKey(userId, date);
        Map<String, HabitDayEntity> byKey = new HashMap<>();
        rows.forEach(r -> byKey.put(r.getHabitKey(), r));
        return HabitDayResponse.builder()
            .date(date)
            .habits(catalog.all().stream()
                .map(def -> mapper.toResponse(def, byKey.get(def.key()), strengths.get(def.key())))
                .toList())
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    @Transactional
    public HabitWriteResponse check(UUID userId, String key, LocalDate date) {
        HabitDef def = requireDef(key);
        requireManualToday(def, date);
        ensureRows(userId, LocalDate.now());
        HabitDayEntity row = repository
            .findByCreatedByAndHabitDateAndHabitKey(userId, date, key)
            .orElseThrow(); // unreachable: ensureRows just created every catalog row for today
        if (!HabitDayEntity.STATUS_PENDING.equals(row.getStatus())) {
            throw conflict("HABIT_ALREADY_DONE");
        }
        List<LevelUpResult> levelUps = complete(row, def, HabitDayEntity.SOURCE_MANUAL);
        return HabitWriteResponse.builder()
            .habit(mapper.toResponse(def, row, null))
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    @Transactional
    public HabitResponse uncheck(UUID userId, String key, LocalDate date) {
        HabitDef def = requireDef(key);
        requireManualToday(def, date);
        HabitDayEntity row = repository
            .findByCreatedByAndHabitDateAndHabitKey(userId, date, key)
            .orElseThrow(() -> conflict("HABIT_NOT_DONE"));
        if (!HabitDayEntity.STATUS_DONE.equals(row.getStatus())
            || !HabitDayEntity.SOURCE_MANUAL.equals(row.getSource())) {
            throw conflict("HABIT_NOT_DONE");
        }
        progressionService.revertHabit(userId, row.getId(), def.skillKey(), row.getXpAwarded());
        row.setStatus(HabitDayEntity.STATUS_PENDING);
        row.setDoneAt(null);
        row.setXpAwarded(0);
        row.setSource(null);
        repository.save(row);
        return mapper.toResponse(def, row, null);
    }

    @Transactional(readOnly = true)
    public HabitSummaryResponse summary(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(properties.summaryDays() - 1L);
        List<HabitDayEntity> window = repository
            .findByCreatedByAndHabitDateBetween(userId, from, today);
        Map<String, Integer> strengths = strengthByKey(userId, today);
        Map<String, long[]> counts = new HashMap<>(); // key -> [done, missed] over 28d
        LocalDate strengthFrom = today.minusDays(properties.strengthWindowDays() - 1L);
        window.stream().filter(r -> !r.getHabitDate().isBefore(strengthFrom)).forEach(r -> {
            long[] c = counts.computeIfAbsent(r.getHabitKey(), k -> new long[2]);
            if (HabitDayEntity.STATUS_DONE.equals(r.getStatus())) {
                c[0]++;
            } else if (HabitDayEntity.STATUS_MISSED.equals(r.getStatus())) {
                c[1]++;
            }
        });
        return HabitSummaryResponse.builder()
            .perfectMorningDays30(perfectDays(window, HabitCatalog.CHAIN_MORNING))
            .perfectEveningDays30(perfectDays(window, HabitCatalog.CHAIN_EVENING))
            .habits(catalog.all().stream().map(def -> {
                long[] c = counts.getOrDefault(def.key(), new long[2]);
                return HabitStrength.builder()
                    .key(def.key())
                    .strengthPct(strengths.get(def.key()))
                    .done28((int) c[0])
                    .missed28((int) c[1])
                    .build();
            }).toList())
            .build();
    }

    /** Close every pending row older than today; the cron and the today-read both call this. */
    @Transactional
    public void closePast(UUID userId, LocalDate today) {
        List<HabitDayEntity> stale = repository
            .findByCreatedByAndStatusAndHabitDateBefore(userId, HabitDayEntity.STATUS_PENDING, today);
        for (HabitDayEntity row : stale) {
            HabitDef def = catalog.byKey(row.getHabitKey()).orElse(null);
            if (def == null) {
                row.setStatus(HabitDayEntity.STATUS_MISSED); // stale catalog key — quiet close
                repository.save(row);
                continue;
            }
            String metric = def.metric();
            if (HabitEvaluator.END_OF_DAY_METRICS.contains(metric)) {
                closeByEvaluation(row, def);
            } else if (HabitEvaluator.METRIC_BED_NEXT_DAY.equals(metric)) {
                boolean deadlinePassed = today.isAfter(row.getHabitDate().plusDays(1))
                    || LocalTime.now().isAfter(LocalTime.NOON);
                if (evaluator.satisfied(metric, row.getCreatedBy(), row.getHabitDate())) {
                    complete(row, def, HabitDayEntity.SOURCE_DERIVED);
                } else if (deadlinePassed) {
                    row.setStatus(HabitDayEntity.STATUS_MISSED);
                    repository.save(row);
                }
            } else {
                closeByEvaluation(row, def); // intraday metric that never fired -> last honest check
            }
        }
    }

    private void closeByEvaluation(HabitDayEntity row, HabitDef def) {
        if (!"manual".equals(def.metric())
            && evaluator.satisfied(def.metric(), row.getCreatedBy(), row.getHabitDate())) {
            complete(row, def, HabitDayEntity.SOURCE_DERIVED);
        } else {
            row.setStatus(HabitDayEntity.STATUS_MISSED); // quiet — ADR 0010
            repository.save(row);
        }
    }

    private List<LevelUpResult> evaluateIntraday(List<HabitDayEntity> rows) {
        List<LevelUpResult> levelUps = new ArrayList<>();
        for (HabitDayEntity row : rows) {
            if (!HabitDayEntity.STATUS_PENDING.equals(row.getStatus())) {
                continue;
            }
            HabitDef def = catalog.byKey(row.getHabitKey()).orElse(null);
            if (def == null || !HabitEvaluator.INTRADAY_METRICS.contains(def.metric())
                || "manual".equals(def.metric())) {
                continue;
            }
            if (evaluator.satisfied(def.metric(), row.getCreatedBy(), row.getHabitDate())) {
                levelUps.addAll(complete(row, def, HabitDayEntity.SOURCE_DERIVED));
            }
        }
        return levelUps;
    }

    private List<LevelUpResult> complete(HabitDayEntity row, HabitDef def, String source) {
        row.setStatus(HabitDayEntity.STATUS_DONE);
        row.setDoneAt(Instant.now());
        row.setXpAwarded(def.xp());
        row.setSource(source);
        repository.save(row);
        if (progressionGate.getIfAvailable() != null) {
            return List.of(progressionService.applyHabit(row.getCreatedBy(),
                new HabitSignal(row.getId(), def.skillKey(), def.xp(), def.title())));
        }
        return List.of();
    }

    private List<HabitDayEntity> ensureRows(UUID userId, LocalDate date) {
        List<HabitDayEntity> existing = repository.findByCreatedByAndHabitDate(userId, date);
        if (!existing.isEmpty()) {
            return existing;
        }
        try {
            List<HabitDayEntity> fresh = catalog.all().stream().map(def -> {
                HabitDayEntity e = new HabitDayEntity();
                e.setCreatedBy(userId);
                e.setHabitDate(date);
                e.setHabitKey(def.key());
                return e;
            }).toList();
            return repository.saveAllAndFlush(fresh);
        } catch (DataIntegrityViolationException e) {
            // lost the race against the cron/another read — the rows exist now
            return repository.findByCreatedByAndHabitDate(userId, date);
        }
    }

    private Map<String, Integer> strengthByKey(UUID userId, LocalDate today) {
        LocalDate from = today.minusDays(properties.strengthWindowDays() - 1L);
        Map<String, long[]> counts = new HashMap<>();
        repository.findByCreatedByAndHabitDateBetween(userId, from, today).forEach(r -> {
            long[] c = counts.computeIfAbsent(r.getHabitKey(), k -> new long[2]);
            if (HabitDayEntity.STATUS_DONE.equals(r.getStatus())) {
                c[0]++;
            } else if (HabitDayEntity.STATUS_MISSED.equals(r.getStatus())) {
                c[1]++;
            }
        });
        Map<String, Integer> strengths = new HashMap<>();
        counts.forEach((key, c) -> {
            long closed = c[0] + c[1];
            strengths.put(key, closed >= properties.minSample()
                ? (int) Math.round(c[0] * 100.0 / closed) : null);
        });
        return strengths;
    }

    private int perfectDays(List<HabitDayEntity> window, String chain) {
        var keys = catalog.forChain(chain).stream().map(HabitDef::key).toList();
        Map<LocalDate, Long> doneByDate = new HashMap<>();
        window.stream()
            .filter(r -> keys.contains(r.getHabitKey())
                && HabitDayEntity.STATUS_DONE.equals(r.getStatus()))
            .forEach(r -> doneByDate.merge(r.getHabitDate(), 1L, Long::sum));
        return (int) doneByDate.values().stream().filter(n -> n == keys.size()).count();
    }

    private HabitDef requireDef(String key) {
        return catalog.byKey(key).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("HABIT_UNKNOWN").build(), HttpStatus.NOT_FOUND));
    }

    private void requireManualToday(HabitDef def, LocalDate date) {
        if (!HabitCatalog.MODE_MANUAL.equals(def.mode())) {
            throw conflict("HABIT_NOT_MANUAL");
        }
        if (!date.equals(LocalDate.now())) {
            throw conflict("HABIT_NOT_TODAY");
        }
    }

    private SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }
}
