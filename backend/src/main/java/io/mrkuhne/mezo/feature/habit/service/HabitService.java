package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.api.dto.HabitStrength;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.config.HabitProperties;
import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
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
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
 * signal fired, else missed (no failure ceremony). Manual habits are user-checked/unchecked (today
 * or yesterday — the backfill window); uncheck reverts the XP so a re-check can re-award. Gated
 * {@code HABIT_SWITCH}.
 *
 * <p>Definitions come from {@link HabitCatalogService} (mezo-n5e9.1) — the DB-backed, per-user
 * catalog that lazily bootstraps from the {@link HabitCatalog} JSON seed on first read.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitService {

    /**
     * The out-of-window wake-hint copy (mezo-czol): server-only computed because only the server
     * knows the wakeup + the goal anchor + {@code wake-window-min} together. This domain's
     * non-error, dynamic user copy has no {@code messages.properties} precedent — that catalog is
     * exclusively wired through {@code SystemMessage}/{@code GlobalExceptionHandler} for
     * REQUEST/FIELD *errors* (see {@code error_handling.md}) — so per the house rule ("no
     * precedent -> a plain code constant"), this stays a constant here rather than growing a new,
     * unprecedented non-error message-resolution path.
     */
    private static final String WAKE_HINT_FORMAT = "%s — a célablakon kívül (%s ± %d′)";
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final HabitDayRepository repository;
    private final HabitCatalogService catalogService;
    private final HabitEvaluator evaluator;
    private final HabitMapper mapper;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final HabitProperties properties;
    private final HabitTargets habitTargets;

    @Transactional
    public HabitDayResponse getDay(UUID userId, LocalDate date) {
        // The one catalog bootstrap call for this whole request (mezo-n5e9.1 review finding 1):
        // its result feeds ensureRows/closeStaleRows below, so neither needs to call it again.
        List<HabitDefEntity> defs = catalogService.ensureCatalog(userId);
        List<HabitDayEntity> rows = repository.findByCreatedByAndHabitDate(userId, date);
        if (rows.isEmpty() && date.equals(LocalDate.now())) {
            rows = ensureRows(userId, date, defs);
        }
        List<LevelUpResult> levelUps = new ArrayList<>();
        if (date.equals(LocalDate.now())) {
            closeStaleRows(userId, staleRows(userId, date), date);
            levelUps.addAll(evaluateIntraday(userId, rows));
        }
        Map<String, Integer> strengths = strengthByKey(userId, date);
        Map<String, HabitDayEntity> byKey = new HashMap<>();
        rows.forEach(r -> byKey.put(r.getHabitKey(), r));
        Map<UUID, String> chainKeyById = chainKeyById(userId);
        return HabitDayResponse.builder()
            .date(date)
            .habits(defs.stream()
                .map(def -> {
                    HabitDayEntity row = byKey.get(def.getHabitKey());
                    return mapper.toResponse(def, chainKeyById.get(def.getChainId()), row,
                        strengths.get(def.getHabitKey()), wakeHint(userId, date, def, row));
                })
                .toList())
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    /**
     * The {@code wake_on_time} row's out-of-window explainer (mezo-czol, live repro: a wakeup
     * honestly outside the goal window left the row pending with zero feedback). Null for every
     * other row, and null here too once the row is no longer pending (done/missed rows never
     * needed a hint) or when the day has no sleep log yet (the CTA must keep offering Logolás —
     * "not logged" and "logged, out of window" are different states, not the same "pending").
     *
     * <p><b>TODAY-only (review fix, mezo-czol):</b> a bare {@code pending} status only PROVES
     * "out of window" on a today read, because {@code evaluateIntraday} runs for today only and
     * would already have flipped an in-window wakeup to {@code done} before this method ever sees
     * the row. A past-day read never runs that evaluation — a day whose rows never materialized
     * (past dates don't lazily create rows, see {@code getDay} above) reads as a synthetic
     * {@code pending} default regardless of what the backfilled sleep log actually says, so
     * inferring "out of window" from bare pending there would be dishonest (an in-window
     * backfilled wakeup would wrongly get the hint). Gating on {@code date.equals(LocalDate.now())}
     * matches {@code evaluateIntraday}'s own scope exactly: past-day rows always get a null hint,
     * consistent with the Rutin tab's past-day view being read-only history, not a live affordance.
     */
    private String wakeHint(UUID userId, LocalDate date, HabitDefEntity def, HabitDayEntity row) {
        if (!"wake_on_time".equals(def.getHabitKey()) || !date.equals(LocalDate.now())) {
            return null;
        }
        String status = row != null ? row.getStatus() : HabitDayEntity.STATUS_PENDING;
        if (!HabitDayEntity.STATUS_PENDING.equals(status)) {
            return null;
        }
        return evaluator.wakeupOf(userId, date)
            .map(wakeup -> WAKE_HINT_FORMAT.formatted(wakeup,
                HH_MM.format(habitTargets.resolve(userId).wake()), properties.wakeWindowMin()))
            .orElse(null);
    }

    @Transactional
    public HabitWriteResponse check(UUID userId, String key, LocalDate date) {
        HabitDefEntity def = requireDef(userId, key);
        requireManualWithinBackfillWindow(def, date);
        // TODAY keeps the full-catalog reconcile (the day's lazy-creation heartbeat — other defs'
        // rows must exist for getDay/evaluateIntraday). A PAST date (backfill) must materialize
        // ONLY the checked key's row: reconciling the whole catalog on a never-opened yesterday
        // would plant pending rows for every other habit too, and closeStaleRows (next today-open)
        // would then silently DERIVED-complete the vacuously-satisfied ones and award unearned XP
        // for a day the user never touched — see mezo-x9c2 final review finding 1.
        if (date.equals(LocalDate.now())) {
            ensureRows(userId, date);
        } else {
            ensureRow(userId, date, def);
        }
        HabitDayEntity row = repository
            .findByCreatedByAndHabitDateAndHabitKey(userId, date, key)
            .orElseThrow(); // unreachable: ensureRows/ensureRow just materialized this row
        // pending (live day) and missed (cron-closed backfill target) both flip; done guards.
        if (!HabitDayEntity.STATUS_PENDING.equals(row.getStatus())
            && !HabitDayEntity.STATUS_MISSED.equals(row.getStatus())) {
            throw conflict("HABIT_ALREADY_DONE");
        }
        List<LevelUpResult> levelUps = complete(row, def, HabitDayEntity.SOURCE_MANUAL);
        String chainKey = chainKeyById(userId).get(def.getChainId());
        return HabitWriteResponse.builder()
            .habit(mapper.toResponse(def, chainKey, row, null, null))
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    @Transactional
    public HabitResponse uncheck(UUID userId, String key, LocalDate date) {
        HabitDefEntity def = requireDef(userId, key);
        requireManualWithinBackfillWindow(def, date);
        HabitDayEntity row = repository
            .findByCreatedByAndHabitDateAndHabitKey(userId, date, key)
            .orElseThrow(() -> conflict("HABIT_NOT_DONE"));
        if (!HabitDayEntity.STATUS_DONE.equals(row.getStatus())
            || !HabitDayEntity.SOURCE_MANUAL.equals(row.getSource())) {
            throw conflict("HABIT_NOT_DONE");
        }
        progressionService.revertHabit(userId, row.getId(), def.getSkillKey(), row.getXpAwarded());
        row.setStatus(HabitDayEntity.STATUS_PENDING);
        row.setDoneAt(null);
        row.setXpAwarded(0);
        row.setSource(null);
        repository.save(row);
        String chainKey = chainKeyById(userId).get(def.getChainId());
        return mapper.toResponse(def, chainKey, row, null, null);
    }

    /**
     * NON-bootstrapping (mezo-n5e9.1 review finding 3): a user who has never touched habits gets
     * an honest empty/zero summary here — their catalog materializes on the first {@code getDay}
     * read, not on a chat-driven summary probe (this is also what {@code ContextSnapshotAssembler}
     * / {@code PracticeTools} call on every companion turn; bootstrapping 17 rows for a dormant
     * account on every chat message was the bug).
     */
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
            .perfectMorningDays30(perfectDays(userId, window, HabitCatalog.CHAIN_MORNING))
            .perfectEveningDays30(perfectDays(userId, window, HabitCatalog.CHAIN_EVENING))
            .habits(catalogService.activeOrderedWithoutBootstrap(userId).stream().map(def -> {
                long[] c = counts.getOrDefault(def.getHabitKey(), new long[2]);
                return HabitStrength.builder()
                    .key(def.getHabitKey())
                    .strengthPct(strengths.get(def.getHabitKey()))
                    .done28((int) c[0])
                    .missed28((int) c[1])
                    .build();
            }).toList())
            .build();
    }

    /**
     * Close every pending row older than today; the nightly cron ({@code HabitJob}) and direct
     * callers use this entry point. The today-read ({@code getDay}) inlines the same
     * {@code staleRows}/{@code closeStaleRows} pair instead, since it has already ensured the
     * catalog itself (mezo-n5e9.1 review finding 1 — avoids a second bootstrap call per request).
     */
    @Transactional
    public void closePast(UUID userId, LocalDate today) {
        List<HabitDayEntity> stale = staleRows(userId, today);
        if (stale.isEmpty()) {
            return; // a user who never touched habits gets zero writes (mezo-n5e9.1 review finding 3)
        }
        catalogService.ensureCatalog(userId); // closePast/HabitJob can run for a never-bootstrapped user
        closeStaleRows(userId, stale, today);
    }

    private List<HabitDayEntity> staleRows(UUID userId, LocalDate today) {
        return repository
            .findByCreatedByAndStatusAndHabitDateBefore(userId, HabitDayEntity.STATUS_PENDING, today);
    }

    private void closeStaleRows(UUID userId, List<HabitDayEntity> stale, LocalDate today) {
        for (HabitDayEntity row : stale) {
            HabitDefEntity def = catalogService.byKey(userId, row.getHabitKey()).orElse(null);
            if (def == null) {
                row.setStatus(HabitDayEntity.STATUS_MISSED); // stale catalog key — quiet close
                repository.save(row);
                continue;
            }
            String metric = def.getMetric();
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

    private void closeByEvaluation(HabitDayEntity row, HabitDefEntity def) {
        if (!"manual".equals(def.getMetric())
            && evaluator.satisfied(def.getMetric(), row.getCreatedBy(), row.getHabitDate())) {
            complete(row, def, HabitDayEntity.SOURCE_DERIVED);
        } else {
            row.setStatus(HabitDayEntity.STATUS_MISSED); // quiet — ADR 0010
            repository.save(row);
        }
    }

    private List<LevelUpResult> evaluateIntraday(UUID userId, List<HabitDayEntity> rows) {
        List<LevelUpResult> levelUps = new ArrayList<>();
        for (HabitDayEntity row : rows) {
            if (!HabitDayEntity.STATUS_PENDING.equals(row.getStatus())) {
                continue;
            }
            HabitDefEntity def = catalogService.byKey(userId, row.getHabitKey()).orElse(null);
            if (def == null || !HabitEvaluator.INTRADAY_METRICS.contains(def.getMetric())
                || "manual".equals(def.getMetric())) {
                continue;
            }
            if (evaluator.satisfied(def.getMetric(), row.getCreatedBy(), row.getHabitDate())) {
                levelUps.addAll(complete(row, def, HabitDayEntity.SOURCE_DERIVED));
            }
        }
        return levelUps;
    }

    private List<LevelUpResult> complete(HabitDayEntity row, HabitDefEntity def, String source) {
        row.setStatus(HabitDayEntity.STATUS_DONE);
        row.setDoneAt(Instant.now());
        row.setXpAwarded(def.getXp());
        row.setSource(source);
        repository.save(row);
        if (progressionGate.getIfAvailable() != null) {
            return List.of(progressionService.applyHabit(row.getCreatedBy(),
                new HabitSignal(row.getId(), def.getSkillKey(), def.getXp(), def.getTitle(),
                    row.getHabitDate())));
        }
        return List.of();
    }

    private List<HabitDayEntity> ensureRows(UUID userId, LocalDate date) {
        return ensureRows(userId, date, catalogService.ensureCatalog(userId));
    }

    /**
     * RECONCILES rather than short-circuits (mezo-n5e9.1 review finding 1 — critical): a def
     * created through the admin API AFTER today's rows already materialized used to be invisible
     * to this method (the old early-return fired on ANY existing row for the day), so
     * {@code check()}'s unconditional call landed on a habit_key with no row and its bare
     * {@code .orElseThrow()} 500'd. Now every active def whose {@code habit_key} has no row yet
     * for {@code date} gets one inserted — a no-op (zero writes) on the common case where nothing
     * changed since the day was last touched.
     */
    private List<HabitDayEntity> ensureRows(UUID userId, LocalDate date, List<HabitDefEntity> defs) {
        List<HabitDayEntity> existing = repository.findByCreatedByAndHabitDate(userId, date);
        Set<String> existingKeys = existing.stream().map(HabitDayEntity::getHabitKey)
            .collect(Collectors.toSet());
        List<HabitDefEntity> missing = defs.stream()
            .filter(def -> !existingKeys.contains(def.getHabitKey()))
            .toList();
        if (missing.isEmpty()) {
            return existing;
        }
        try {
            List<HabitDayEntity> fresh = missing.stream().map(def -> {
                HabitDayEntity e = new HabitDayEntity();
                e.setCreatedBy(userId);
                e.setHabitDate(date);
                e.setHabitKey(def.getHabitKey());
                return e;
            }).toList();
            List<HabitDayEntity> saved = repository.saveAllAndFlush(fresh);
            List<HabitDayEntity> all = new ArrayList<>(existing);
            all.addAll(saved);
            return all;
        } catch (DataIntegrityViolationException e) {
            // lost the race against the cron/another read/concurrent check — the rows exist now
            return repository.findByCreatedByAndHabitDate(userId, date);
        }
    }

    /**
     * Single-row counterpart to {@link #ensureRows(UUID, LocalDate, List)} for a PAST date
     * (mezo-x9c2 final review finding 1): materializes only the one def's row for {@code date},
     * never the whole catalog — reconciling every def would plant pending rows for unrelated
     * habits on a never-opened yesterday, which the next today-open's {@code closeStaleRows}
     * would then silently DERIVED-complete (some metrics are vacuously satisfied with zero data)
     * and award XP for a day the user never touched. No-op if the row already exists.
     */
    private void ensureRow(UUID userId, LocalDate date, HabitDefEntity def) {
        if (repository.findByCreatedByAndHabitDateAndHabitKey(userId, date, def.getHabitKey())
            .isPresent()) {
            return;
        }
        HabitDayEntity e = new HabitDayEntity();
        e.setCreatedBy(userId);
        e.setHabitDate(date);
        e.setHabitKey(def.getHabitKey());
        try {
            repository.saveAndFlush(e);
        } catch (DataIntegrityViolationException ex) {
            // lost the race against a concurrent check/cron for this exact row — it exists now
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

    private int perfectDays(UUID userId, List<HabitDayEntity> window, String chainKey) {
        var keys = catalogService.activeForChainKey(userId, chainKey).stream()
            .map(HabitDefEntity::getHabitKey).toList();
        Map<LocalDate, Long> doneByDate = new HashMap<>();
        window.stream()
            .filter(r -> keys.contains(r.getHabitKey())
                && HabitDayEntity.STATUS_DONE.equals(r.getStatus()))
            .forEach(r -> doneByDate.merge(r.getHabitDate(), 1L, Long::sum));
        return (int) doneByDate.values().stream().filter(n -> n == keys.size()).count();
    }

    private HabitDefEntity requireDef(UUID userId, String key) {
        catalogService.ensureCatalog(userId); // check/uncheck can be the very first catalog touch
        return catalogService.byKey(userId, key).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("HABIT_UNKNOWN").build(), HttpStatus.NOT_FOUND));
    }

    /**
     * MANUAL check/uncheck gate (mezo-x9c2): the write must target a MANUAL def and a date
     * inside the backfill window — {@code today - backfillDays .. today}. One code for both
     * out-of-window sides (older AND future): a future date is a client bug, not a product
     * state, so it does not earn its own code.
     */
    private void requireManualWithinBackfillWindow(HabitDefEntity def, LocalDate date) {
        if (!HabitDefEntity.MODE_MANUAL.equals(def.getMode())) {
            throw conflict("HABIT_NOT_MANUAL");
        }
        LocalDate today = LocalDate.now();
        if (date.isAfter(today) || date.isBefore(today.minusDays(properties.backfillDays()))) {
            throw conflict("HABIT_TOO_OLD");
        }
    }

    private Map<UUID, String> chainKeyById(UUID userId) {
        return catalogService.chains(userId).stream()
            .collect(Collectors.toMap(HabitChainEntity::getId, HabitChainEntity::getChainKey));
    }

    private SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }
}
