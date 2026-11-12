package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.CheckInSnapshot;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.mapper.CheckInMapper;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInSnapshotRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInBiomarkerSource.CheckInSnapshotValues;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class CheckInService {

    /** The evening slot — written by the Boop day close's merge, never by a Boop check-in (spec §7.2). */
    public static final String EVENING_SLOT = "20:00";

    private static final String STATE_DONE = "done";

    /** Oldest accepted day: today − 7 in the owner zone (the same window as the day close, spec §7.2). */
    static final int MAX_PAST_DAYS = 7;

    /** A {@code capturedAt} further than this in the future is a 400 (a phone clock may run slightly ahead). */
    static final Duration MAX_CAPTURED_AHEAD = Duration.ofMinutes(5);

    private final CheckInRepository repository;
    private final CheckInSnapshotRepository snapshotRepository;
    private final CheckInBiomarkerSource biomarkerSource;
    private final CheckInMapper mapper;
    private final OwnerZoneProperties ownerZone;
    private final PlatformTransactionManager transactionManager;
    private final ApplicationEventPublisher eventPublisher;

    public List<CheckInResponse> listForDay(UUID createdBy, LocalDate date) {
        List<CheckInEntity> rows = repository.findByCreatedByAndDateOrderBySlotTime(createdBy, date);
        Map<UUID, CheckInSnapshotEntity> snapshots = rows.isEmpty() ? Map.of()
            : snapshotRepository.findByCheckInIdIn(rows.stream().map(CheckInEntity::getId).toList()).stream()
                .collect(Collectors.toMap(CheckInSnapshotEntity::getCheckInId, Function.identity()));
        return rows.stream().map(row -> toResponse(row, snapshots.get(row.getId()))).toList();
    }

    /**
     * Upsert on the (createdBy, date, slotTime) slot — one row per slot per day, full replace. Boop B3
     * (mezo-r36n9.13): {@code capturedAt} is the record's moment ({@code saved_at}, default now); the date must
     * lie within today − 7 … today in the owner zone; the biomarker snapshot (the phone's, else the server's)
     * is written in the same transaction.
     *
     * <p><b>Callers must not hold a transaction</b> (the controller does not): the server fallback's Health
     * reads run BEFORE the write transaction, so a failing read can only leave the snapshot empty — inside a
     * caller's transaction a failed SQL read would abort it. Concurrent saves of one slot are safe without a
     * retry: the row and its snapshot are created with {@code INSERT … ON CONFLICT DO NOTHING} and read back.
     */
    public CheckInResponse save(UUID createdBy, SaveCheckInRequest req) {
        requireInWindow(req.getDate());
        Instant savedAt = Optional.ofNullable(req.getCapturedAt()).map(OffsetDateTime::toInstant)
            .orElseGet(Instant::now);
        requireNotAhead(savedAt);
        Optional<CheckInSnapshotValues> serverValues = req.getSnapshot() == null
            ? serverValues(createdBy, savedAt) : Optional.empty();
        return new TransactionTemplate(transactionManager)
            .execute(status -> write(createdBy, req, savedAt, serverValues));
    }

    /**
     * The Boop day close's evening write (spec §7.2, dual-write §7.4): a MERGE into the {@code 20:00} slot that
     * sets only {@code energy}, {@code day_rating} and {@code saved_at} on an existing row (e.g. a web evening
     * check-in keeps its mood and note), or creates a minimal {@code done} row with just those two answers. A
     * row that was {@code skipped} (or pending) becomes {@code done}: the close answered it.
     *
     * <p>Unlike {@link #save}, this method JOINS a caller's transaction (the day close's dual-write, spec §7.4,
     * stays atomic) and reads no Health data. It needs no retry for concurrent closes of the same day: the row
     * is created with {@code INSERT … ON CONFLICT DO NOTHING}, which never raises inside the caller's transaction.
     */
    public CheckInResponse mergeEvening(UUID owner, LocalDate date, Integer energy, Integer dayRating10,
                                        Instant capturedAt) {
        requireInWindow(date);
        Instant savedAt = capturedAt == null ? Instant.now() : capturedAt;
        requireNotAhead(savedAt);
        return new TransactionTemplate(transactionManager).execute(status -> {
            boolean created = repository.insertSlotIfAbsent(owner, date, EVENING_SLOT, STATE_DONE) == 1;
            CheckInEntity e = repository.findByCreatedByAndDateAndSlotTime(owner, date, EVENING_SLOT)
                .orElseThrow(); // just ensured by the insert above (live row, or a legacy soft-deleted one)
            if (created) {
                e.setAskedItems(List.of(CheckInItemId.ENERGY.getValue(), CheckInItemId.DAY.getValue()));
                e.setQuickExit(false);
            }
            e.setState(STATE_DONE);
            e.setEnergy(energy);
            e.setDayRating(dayRating10);
            e.setSavedAt(savedAt);
            CheckInEntity saved = repository.saveAndFlush(e);
            eventPublisher.publishEvent(new CheckInSavedEvent(owner, date));
            return toResponse(saved, snapshotRepository.findByCheckInId(saved.getId()).orElse(null));
        });
    }

    private CheckInResponse write(UUID createdBy, SaveCheckInRequest req, Instant savedAt,
                                  Optional<CheckInSnapshotValues> serverValues) {
        // Race-safe upsert on the (createdBy, date, slotTime) slot — one row per slot per day, full replace.
        // A soft-deleted row still holds the slot's unique key (legacy, pre-B3): then the find comes back empty
        // and the insert below fails exactly as it did before.
        repository.insertSlotIfAbsent(createdBy, req.getDate(), req.getSlotTime(), req.getState());
        CheckInEntity e = repository
            .findByCreatedByAndDateAndSlotTime(createdBy, req.getDate(), req.getSlotTime())
            .orElseGet(CheckInEntity::new);
        e.setCreatedBy(createdBy); // server-side from principal, never from client
        e.setDate(req.getDate());
        e.setSlotTime(req.getSlotTime());
        e.setState(req.getState());
        e.setEnergy(req.getEnergy());
        e.setStress(req.getStress());
        e.setBody(req.getBody());
        e.setMental(req.getMental());
        e.setNote(req.getNote());
        // Check-in 2.0 (mezo-ck2): stored exactly as received — NULL stays NULL (not answered),
        // nothing is defaulted. quickExit is a flag, not an answer: absent = false.
        e.setMood(req.getMood());
        e.setRested(req.getRested());
        e.setSoreness(req.getSoreness());
        e.setPain(req.getPain());
        e.setPainRegions(mapper.toPainRegions(req.getPainRegions()));
        e.setPainIntensity(req.getPainIntensity());
        e.setMotivation(req.getMotivation());
        e.setHunger(req.getHunger());
        e.setCraving(req.getCraving());
        e.setCravingKinds(mapper.toCravingKinds(req.getCravingKinds()));
        e.setDigestion(req.getDigestion());
        e.setConnection(req.getConnection());
        e.setDayRating(req.getDayRating());
        e.setAskedItems(mapper.toItemIds(req.getAskedItems()));
        e.setAdaptiveItem(req.getAdaptiveItem() == null ? null : req.getAdaptiveItem().getValue());
        e.setAdaptiveReason(req.getAdaptiveReason() == null ? null : req.getAdaptiveReason().getValue());
        e.setQuickExit(Boolean.TRUE.equals(req.getQuickExit()));
        e.setSavedAt(savedAt);
        CheckInEntity saved = repository.saveAndFlush(e);
        CheckInSnapshotEntity snapshot = writeSnapshot(createdBy, saved, req.getSnapshot(), serverValues);
        // W5.1 (mezo-b3pp.18): the companion's flag evaluator reacts AFTER_COMMIT; a failure there
        // can never fail or slow this write (the listener is @Async and swallows its own errors).
        eventPublisher.publishEvent(new CheckInSavedEvent(createdBy, saved.getDate()));
        return toResponse(saved, snapshot);
    }

    /**
     * The phone's snapshot always wins (and replaces the slot's live one on a re-save). Without one, a slot
     * that already has a snapshot keeps it — it is frozen at the first capture — unless it is a server snapshot
     * with no reading at all (the Health data may have synced since); a slot without one gets the server's,
     * read from the Health data around {@code saved_at} before the transaction (all nulls when there is none).
     */
    private CheckInSnapshotEntity writeSnapshot(UUID createdBy, CheckInEntity checkIn, CheckInSnapshot phone,
                                                Optional<CheckInSnapshotValues> serverValues) {
        Optional<CheckInSnapshotEntity> existing = snapshotRepository.findByCheckInId(checkIn.getId());
        if (phone == null && existing.isPresent() && !isEmptyServerSnapshot(existing.get())) {
            return existing.get();
        }
        String computedBy = phone != null
            ? CheckInSnapshotEntity.COMPUTED_BY_PHONE : CheckInSnapshotEntity.COMPUTED_BY_SERVER;
        if (existing.isEmpty()) {
            snapshotRepository.insertIfAbsent(createdBy, checkIn.getId(), computedBy);
        }
        CheckInSnapshotEntity s = existing.orElseGet(() -> snapshotRepository.findByCheckInId(checkIn.getId())
            .orElseThrow()); // just ensured by insertIfAbsent
        s.setCreatedBy(createdBy);
        s.setCheckInId(checkIn.getId());
        if (phone != null) {
            s.setHrBpm(phone.getHrBpm());
            s.setHrAt(toInstant(phone.getHrAt()));
            s.setHrvMs(phone.getHrvMs());
            s.setHrvAt(toInstant(phone.getHrvAt()));
            s.setHrvUsualMs(phone.getHrvUsualMs());
            s.setSteps(phone.getSteps());
            s.setStepsIsDayTotal(phone.getStepsIsDayTotal());
            s.setSleepMinutes(phone.getSleepMinutes());
            s.setSource(phone.getSource());
            s.setComputedBy(CheckInSnapshotEntity.COMPUTED_BY_PHONE); // a client can never claim "server"
        } else {
            CheckInSnapshotValues v = serverValues.orElse(EMPTY_VALUES);
            s.setHrBpm(v.hrBpm());
            s.setHrAt(v.hrAt());
            s.setHrvMs(v.hrvMs());
            s.setHrvAt(v.hrvAt());
            s.setHrvUsualMs(v.hrvUsualMs());
            s.setSteps(v.steps());
            s.setStepsIsDayTotal(v.stepsIsDayTotal());
            s.setSleepMinutes(v.sleepMinutes());
            s.setSource(v.source());
            s.setComputedBy(CheckInSnapshotEntity.COMPUTED_BY_SERVER);
        }
        s.setUpdatedAt(Instant.now());
        return snapshotRepository.saveAndFlush(s);
    }

    private static final CheckInSnapshotValues EMPTY_VALUES =
        new CheckInSnapshotValues(null, null, null, null, null, null, null, null, null);

    private static boolean isEmptyServerSnapshot(CheckInSnapshotEntity s) {
        return CheckInSnapshotEntity.COMPUTED_BY_SERVER.equals(s.getComputedBy())
            && s.getHrBpm() == null && s.getHrvMs() == null && s.getHrvUsualMs() == null && s.getSteps() == null
            && s.getSleepMinutes() == null;
    }

    /** The server's readings never fail a check-in: an error is logged and the snapshot stays empty. */
    private Optional<CheckInSnapshotValues> serverValues(UUID owner, Instant at) {
        try {
            return biomarkerSource.snapshotAt(owner, at);
        } catch (RuntimeException ex) {
            log.warn("Check-in snapshot fallback failed for {} at {}: {}", owner, at, ex.toString());
            return Optional.empty();
        }
    }

    /** Today − 7 … today in the owner zone; anything else is the 400 field error on {@code date}. */
    private void requireInWindow(LocalDate date) {
        LocalDate today = LocalDate.now(ownerZone.zoneId());
        if (date == null || date.isAfter(today) || date.isBefore(today.minusDays(MAX_PAST_DAYS))) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "date").build(),
                HttpStatus.BAD_REQUEST);
        }
    }

    /** A capture moment more than {@link #MAX_CAPTURED_AHEAD} in the future: the 400 field error on {@code capturedAt}. */
    private static void requireNotAhead(Instant capturedAt) {
        if (capturedAt.isAfter(Instant.now().plus(MAX_CAPTURED_AHEAD))) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "capturedAt").build(), HttpStatus.BAD_REQUEST);
        }
    }

    private CheckInResponse toResponse(CheckInEntity row, CheckInSnapshotEntity snapshot) {
        CheckInResponse response = mapper.toResponse(row);
        response.setSnapshot(mapper.toSnapshot(snapshot));
        return response;
    }

    private static Instant toInstant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }
}
