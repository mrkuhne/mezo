package io.mrkuhne.mezo.feature.dayclose.service;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.DayCloseRequest;
import io.mrkuhne.mezo.api.dto.DayCloseResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.dayclose.config.DayCloseProperties;
import io.mrkuhne.mezo.feature.dayclose.entity.DayCloseEntity;
import io.mrkuhne.mezo.feature.dayclose.entity.DayCloseLineCacheEntity;
import io.mrkuhne.mezo.feature.dayclose.mapper.DayCloseMapper;
import io.mrkuhne.mezo.feature.dayclose.repository.DayCloseLineCacheRepository;
import io.mrkuhne.mezo.feature.dayclose.repository.DayCloseRepository;
import io.mrkuhne.mezo.feature.dayclose.service.DayCloseLineWriter.DayInputs;
import io.mrkuhne.mezo.feature.dayclose.service.DayCloseLineWriter.Prompt;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.service.JournalService;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Boop day close (B3, mezo-r36n9.13, spec §7.4) — one {@code day_close} record per owner and date, the
 * single source of truth for the evening close.
 *
 * <p>{@link #put} is an idempotent upsert (natural key: owner + date; {@code INSERT … ON CONFLICT DO NOTHING}
 * then fill) that, in the SAME transaction, dual-writes the legacy evening stores so every existing reader keeps
 * working: {@code daily_intention.reflection} from the goal outcome (done→yes, partial→partial, no→no; left
 * alone when the goal was not judged), {@code ritual_day.closed_at} through {@link RitualService#closeOn} (the
 * web's {@code reflection_text} is never written nor cleared — the evening text lives in the journal only), and
 * the {@code 20:00} check-in merge ({@code energy} = the evening energy — the slot's existing energy when Boop
 * has none — and {@code day_rating} = rating × 2). A {@code journalClientRef} is resolved to the entry id when
 * that entry has arrived; an unknown ref is ignored (a later PUT links it) and a PUT without one keeps the link.
 * A {@link DayClosedEvent} is published.
 *
 * <p>{@link #get} / {@link #list} fall back to the legacy stores for a day closed on the web (no {@code day_close}
 * row, {@code ritual_day.closed_at} set) and mark it {@code source = web}; its rating is the 20:00
 * {@code day_rating} ÷ 2 rounded, or null when the web evening had none.
 *
 * <p>Dates: today … today − {@code mezo.dayclose.max-past-days} in the owner zone ({@code mezo.wearable.zone});
 * anything else is a 400. "Now" is the application {@link Clock} when one is defined (tests), else the system
 * clock — never {@code LocalDate.now()} in the server's zone.
 *
 * <p>Boop's lines ({@link #dayLine}, {@link #checkInLine}) run outside any transaction (the model call is slow):
 * a close's line is stored on its row with the inputs' hash (a re-close with other inputs drops it); the lines
 * without a row of their own — after a check-in, for a web-closed day — go to {@code day_close_line_cache}
 * keyed by the same hash. No model → 503 {@code DAY_CLOSE_LINE_UNAVAILABLE}, nothing cached.
 *
 * <p>Ritual, intention and journal are switchable features: with one off, its legacy write (or read) is skipped.
 */
@Service
public class DayCloseService {

    /** A {@code capturedAt} further than this in the future is a 400 (a phone clock may run slightly ahead). */
    static final Duration MAX_CAPTURED_AHEAD = Duration.ofMinutes(5);

    private static final String STATE_DONE = "done";

    private final DayCloseRepository repository;
    private final DayCloseLineCacheRepository lineCache;
    private final DayCloseMapper mapper;
    private final DayCloseLineWriter lineWriter;
    private final CheckInService checkIns;
    private final ObjectProvider<IntentionService> intention;
    private final ObjectProvider<RitualService> ritual;
    private final ObjectProvider<JournalService> journal;
    private final OwnerZoneProperties ownerZone;
    private final DayCloseProperties properties;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectProvider<Clock> clock;

    public DayCloseService(DayCloseRepository repository, DayCloseLineCacheRepository lineCache, DayCloseMapper mapper,
                           DayCloseLineWriter lineWriter, CheckInService checkIns,
                           ObjectProvider<IntentionService> intention, ObjectProvider<RitualService> ritual,
                           ObjectProvider<JournalService> journal, OwnerZoneProperties ownerZone,
                           DayCloseProperties properties, ApplicationEventPublisher eventPublisher,
                           ObjectProvider<Clock> clock) {
        this.repository = repository;
        this.lineCache = lineCache;
        this.mapper = mapper;
        this.lineWriter = lineWriter;
        this.checkIns = checkIns;
        this.intention = intention;
        this.ritual = ritual;
        this.journal = journal;
        this.ownerZone = ownerZone;
        this.properties = properties;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
    }

    @Transactional
    public DayCloseResponse put(UUID owner, LocalDate date, DayCloseRequest req) {
        requireInWindow(date);
        Instant closedAt = Optional.ofNullable(req.getCapturedAt()).map(OffsetDateTime::toInstant)
            .orElseGet(() -> clock().instant()).truncatedTo(ChronoUnit.MICROS);
        if (closedAt.isAfter(clock().instant().plus(MAX_CAPTURED_AHEAD))) {
            throw fieldError("capturedAt");
        }
        Integer rating = req.getDayRating();
        if (rating == null || rating < 1 || rating > 5) {
            throw fieldError("dayRating");
        }
        Integer energy = req.getEveningEnergy();
        if (energy != null && (energy < 1 || energy > 10)) {
            throw fieldError("eveningEnergy");
        }
        String outcome = req.getGoalOutcome() == null ? null : req.getGoalOutcome().getValue();
        UUID clientRef = req.getClientRef() == null ? UUID.randomUUID() : req.getClientRef();

        repository.insertIfAbsent(owner, date, closedAt, rating, clientRef);
        DayCloseEntity row = repository.findByCreatedByAndCloseDate(owner, date).orElseThrow(); // just ensured
        row.setClosedAt(closedAt);
        row.setEveningEnergy(energy);
        row.setDayRating(rating);
        row.setGoalText(blankToNull(req.getGoalText()));
        row.setGoalOutcome(outcome);
        row.setPlanGoals(mapper.writePlanGoals(req.getPlanGoals()));
        row.setClientRef(clientRef);
        resolveJournal(owner, req.getJournalClientRef()).ifPresent(row::setJournalEntryId);
        if (row.getBoopLineHash() != null && !row.getBoopLineHash().equals(dayPrompt(row).hash())) {
            row.setBoopLine(null); // the sentence described other inputs
            row.setBoopLineHash(null);
        }
        row.setUpdatedAt(clock().instant().truncatedTo(ChronoUnit.MICROS));
        DayCloseEntity saved = repository.saveAndFlush(row);

        writeLegacy(owner, date, closedAt, rating, energy, outcome);
        eventPublisher.publishEvent(new DayClosedEvent(owner, date));
        return mapper.toResponse(saved, journalText(owner, saved.getJournalEntryId()));
    }

    @Transactional(readOnly = true)
    public Optional<DayCloseResponse> get(UUID owner, LocalDate date) {
        Optional<DayCloseEntity> row = repository.findByCreatedByAndCloseDate(owner, date);
        if (row.isPresent()) {
            return Optional.of(mapper.toResponse(row.get(), journalText(owner, row.get().getJournalEntryId())));
        }
        RitualService ritualService = ritual.getIfAvailable();
        if (ritualService == null) {
            return Optional.empty();
        }
        RitualDayResponse day = ritualService.getDay(owner, date);
        return Boolean.TRUE.equals(day.getClosed()) ? Optional.of(webClose(owner, day)) : Optional.empty();
    }

    /** {@code from … to} inclusive, newest first; Boop closes plus the days closed only on the web. */
    @Transactional(readOnly = true)
    public List<DayCloseResponse> list(UUID owner, LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw fieldError("from");
        }
        if (ChronoUnit.DAYS.between(from, to) >= properties.maxRangeDays()) {
            throw fieldError("to");
        }
        Map<LocalDate, DayCloseEntity> rows = repository.findByCreatedByAndCloseDateBetween(owner, from, to).stream()
            .collect(Collectors.toMap(DayCloseEntity::getCloseDate, Function.identity()));
        List<DayCloseResponse> out = new ArrayList<>();
        rows.values().forEach(r -> out.add(mapper.toResponse(r, journalText(owner, r.getJournalEntryId()))));
        RitualService ritualService = ritual.getIfAvailable();
        if (ritualService != null) {
            for (RitualDayResponse day : ritualService.listClosed(owner, from, to)) {
                if (!rows.containsKey(day.getDate())) {
                    out.add(webClose(owner, day));
                }
            }
        }
        out.sort(Comparator.comparing(DayCloseResponse::getDate).reversed());
        return out;
    }

    /** Boop's sentence about the closed day; 404 when the day is not closed, 503 when the model is not there. */
    public String dayLine(UUID owner, LocalDate date) {
        Optional<DayCloseEntity> row = repository.findByCreatedByAndCloseDate(owner, date);
        if (row.isPresent()) {
            DayCloseEntity close = row.get();
            Prompt prompt = dayPrompt(close);
            if (close.getBoopLine() != null && prompt.hash().equals(close.getBoopLineHash())) {
                return close.getBoopLine();
            }
            String line = lineWriter.write(prompt).orElseThrow(DayCloseService::lineUnavailable);
            repository.storeLine(close.getId(), owner, close.getUpdatedAt(), line, prompt.hash());
            return line;
        }
        DayCloseResponse web = get(owner, date).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("DAY_CLOSE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        return cachedLine(owner, lineWriter.dayPrompt(new DayInputs(web.getDate(), web.getDayRating(),
            web.getEveningEnergy(), web.getGoalText(),
            web.getGoalOutcome() == null ? null : web.getGoalOutcome().getValue(), web.getPlanGoals())));
    }

    /**
     * Boop's line after the check-in of {@code slot} on {@code date} (spec §5.2): its answers, the energy against
     * the day's earlier check-ins, the watch snapshot. 400 for a date outside the window, an empty slot or a slot
     * with no done check-in; 503 when the model is not there.
     */
    public String checkInLine(UUID owner, LocalDate date, String slot) {
        requireInWindow(date);
        if (slot == null || slot.isBlank()) {
            throw fieldError("slot");
        }
        List<CheckInResponse> day = checkIns.listForDay(owner, date);
        CheckInResponse current = day.stream()
            .filter(c -> slot.equals(c.getSlotTime()) && STATE_DONE.equals(c.getState()))
            .findFirst().orElseThrow(() -> fieldError("slot"));
        List<CheckInResponse> earlier = day.stream()
            .filter(c -> STATE_DONE.equals(c.getState()) && c.getSlotTime().compareTo(slot) < 0)
            .sorted(Comparator.comparing(CheckInResponse::getSlotTime))
            .toList();
        return cachedLine(owner, lineWriter.checkInPrompt(current, earlier));
    }

    private String cachedLine(UUID owner, Prompt prompt) {
        return lineCache.findByCreatedByAndInputHash(owner, prompt.hash())
            .map(DayCloseLineCacheEntity::getLine)
            .orElseGet(() -> {
                String line = lineWriter.write(prompt).orElseThrow(DayCloseService::lineUnavailable);
                lineCache.insertIfAbsent(owner, prompt.hash(), line);
                return line;
            });
    }

    private Prompt dayPrompt(DayCloseEntity row) {
        return lineWriter.dayPrompt(new DayInputs(row.getCloseDate(), row.getDayRating(), row.getEveningEnergy(),
            row.getGoalText(), row.getGoalOutcome(), mapper.readPlanGoals(row.getPlanGoals())));
    }

    private void writeLegacy(UUID owner, LocalDate date, Instant closedAt, int rating, Integer energy,
                             String outcome) {
        IntentionService intentionService = intention.getIfAvailable();
        if (outcome != null && intentionService != null) {
            intentionService.reflect(owner, date, toReflection(outcome));
        }
        RitualService ritualService = ritual.getIfAvailable();
        if (ritualService != null) {
            ritualService.closeOn(owner, date, closedAt);
        }
        Integer eveningEnergy = energy != null ? energy : eveningCheckIn(owner, date)
            .map(CheckInResponse::getEnergy).orElse(null);
        checkIns.mergeEvening(owner, date, eveningEnergy, rating * 2, closedAt);
    }

    /** A day closed on the web: the ritual row says closed; the rest comes from the legacy evening stores. */
    private DayCloseResponse webClose(UUID owner, RitualDayResponse day) {
        LocalDate date = day.getDate();
        String goalText = null;
        DayCloseResponse.GoalOutcomeEnum outcome = null;
        IntentionService intentionService = intention.getIfAvailable();
        if (intentionService != null) {
            IntentionDayResponse intentionDay = intentionService.getDay(owner, date);
            if (intentionDay.getFoci() != null && !intentionDay.getFoci().isEmpty()) {
                goalText = intentionDay.getFoci().get(0).getText();
            }
            if (intentionDay.getReflection() != null) {
                outcome = DayCloseResponse.GoalOutcomeEnum.fromValue(fromReflection(intentionDay.getReflection().getValue()));
            }
        }
        Optional<CheckInResponse> evening = eveningCheckIn(owner, date);
        Integer rating10 = evening.map(CheckInResponse::getDayRating).orElse(null);
        // no evening rating on the web → null, never an invented value (controller ruling, Task 4 fix round)
        Integer rating = rating10 == null ? null : (int) Math.max(1, Math.min(5, Math.round(rating10 / 2.0)));
        return new DayCloseResponse()
            .date(date)
            .closedAt(day.getClosedAt())
            .eveningEnergy(evening.map(CheckInResponse::getEnergy).orElse(null))
            .dayRating(rating)
            .goalText(goalText)
            .goalOutcome(outcome)
            .planGoals(List.of())
            .journalText(day.getReflectionText())
            .source(DayCloseResponse.SourceEnum.WEB);
    }

    private Optional<CheckInResponse> eveningCheckIn(UUID owner, LocalDate date) {
        return checkIns.listForDay(owner, date).stream()
            .filter(c -> CheckInService.EVENING_SLOT.equals(c.getSlotTime()))
            .findFirst();
    }

    private Optional<UUID> resolveJournal(UUID owner, UUID journalClientRef) {
        JournalService journalService = journal.getIfAvailable();
        if (journalClientRef == null || journalService == null) {
            return Optional.empty();
        }
        return journalService.findByClientRef(owner, journalClientRef).map(JournalEntryEntity::getId);
    }

    private String journalText(UUID owner, UUID entryId) {
        JournalService journalService = journal.getIfAvailable();
        if (entryId == null || journalService == null) {
            return null;
        }
        return journalService.findText(owner, entryId).orElse(null);
    }

    /** Today − {@code max-past-days} … today in the owner zone; anything else is the 400 field error on {@code date}. */
    private void requireInWindow(LocalDate date) {
        LocalDate today = LocalDate.now(clock().withZone(ownerZone.zoneId()));
        if (date == null || date.isAfter(today) || date.isBefore(today.minusDays(properties.maxPastDays()))) {
            throw fieldError("date");
        }
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }

    private static String toReflection(String outcome) {
        return DayCloseEntity.OUTCOME_DONE.equals(outcome) ? "yes" : outcome;
    }

    private static String fromReflection(String reflection) {
        return "yes".equals(reflection) ? DayCloseEntity.OUTCOME_DONE : reflection;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private static SystemRuntimeErrorException fieldError(String field) {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(),
            HttpStatus.BAD_REQUEST);
    }

    private static SystemRuntimeErrorException lineUnavailable() {
        return new SystemRuntimeErrorException(SystemMessage.error("DAY_CLOSE_LINE_UNAVAILABLE").build(),
            HttpStatus.SERVICE_UNAVAILABLE);
    }
}
