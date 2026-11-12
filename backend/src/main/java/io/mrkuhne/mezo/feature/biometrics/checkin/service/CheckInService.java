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
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
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

    /** Oldest accepted day: today − 7 in the owner zone (the same window as the day close, spec §7.2). */
    static final int MAX_PAST_DAYS = 7;

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
     */
    public CheckInResponse save(UUID createdBy, SaveCheckInRequest req) {
        requireInWindow(req.getDate());
        Instant savedAt = Optional.ofNullable(req.getCapturedAt()).map(OffsetDateTime::toInstant)
            .orElseGet(Instant::now);
        return writeRaceSafe(() -> write(createdBy, req, savedAt));
    }

    /**
     * The Boop day close's evening write (spec §7.2, dual-write §7.4): a MERGE into the {@code 20:00} slot that
     * sets only {@code energy}, {@code day_rating} and {@code saved_at} on an existing row (e.g. a web evening
     * check-in keeps its mood and note), or creates a minimal {@code done} row with just those two answers.
     */
    public CheckInResponse mergeEvening(UUID owner, LocalDate date, Integer energy, Integer dayRating10,
                                        Instant capturedAt) {
        requireInWindow(date);
        Instant savedAt = capturedAt == null ? Instant.now() : capturedAt;
        return writeRaceSafe(() -> {
            CheckInEntity e = repository.findByCreatedByAndDateAndSlotTime(owner, date, EVENING_SLOT)
                .orElseGet(() -> minimalEveningRow(owner, date));
            e.setEnergy(energy);
            e.setDayRating(dayRating10);
            e.setSavedAt(savedAt);
            CheckInEntity saved = repository.saveAndFlush(e);
            eventPublisher.publishEvent(new CheckInSavedEvent(owner, date));
            return toResponse(saved, snapshotRepository.findByCheckInId(saved.getId()).orElse(null));
        });
    }

    private static CheckInEntity minimalEveningRow(UUID owner, LocalDate date) {
        CheckInEntity e = new CheckInEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setSlotTime(EVENING_SLOT);
        e.setState("done");
        e.setAskedItems(List.of(CheckInItemId.ENERGY.getValue(), CheckInItemId.DAY.getValue()));
        e.setQuickExit(false);
        return e;
    }

    private CheckInResponse write(UUID createdBy, SaveCheckInRequest req, Instant savedAt) {
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
        CheckInSnapshotEntity snapshot = writeSnapshot(createdBy, saved, req.getSnapshot());
        // W5.1 (mezo-b3pp.18): the companion's flag evaluator reacts AFTER_COMMIT; a failure there
        // can never fail or slow this write (the listener is @Async and swallows its own errors).
        eventPublisher.publishEvent(new CheckInSavedEvent(createdBy, saved.getDate()));
        return toResponse(saved, snapshot);
    }

    /**
     * The phone's snapshot always wins (and replaces the slot's live one on a re-save). Without one, a slot
     * that already has a snapshot keeps it — it is frozen at the first capture — and a slot without one gets
     * the server's, read from the Health data around {@code saved_at} (all nulls when there is none).
     */
    private CheckInSnapshotEntity writeSnapshot(UUID createdBy, CheckInEntity checkIn, CheckInSnapshot phone) {
        Optional<CheckInSnapshotEntity> existing = snapshotRepository.findByCheckInId(checkIn.getId());
        if (phone == null && existing.isPresent()) {
            return existing.get();
        }
        CheckInSnapshotEntity s = existing.orElseGet(CheckInSnapshotEntity::new);
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
            serverValues(createdBy, checkIn.getSavedAt()).ifPresent(v -> {
                s.setHrBpm(v.hrBpm());
                s.setHrAt(v.hrAt());
                s.setHrvMs(v.hrvMs());
                s.setHrvAt(v.hrvAt());
                s.setHrvUsualMs(v.hrvUsualMs());
                s.setSteps(v.steps());
                s.setStepsIsDayTotal(v.stepsIsDayTotal());
                s.setSleepMinutes(v.sleepMinutes());
                s.setSource(v.source());
            });
            s.setComputedBy(CheckInSnapshotEntity.COMPUTED_BY_SERVER);
        }
        s.setUpdatedAt(Instant.now());
        return snapshotRepository.saveAndFlush(s);
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

    /**
     * One write in its own transaction. Two saves of the same slot racing past the "find" both insert; the
     * loser's unique violation ({@code uq_check_in_created_by_date_slot} / {@code uq_check_in_snapshot_check_in_live})
     * rolls its transaction back and the write runs once more, now finding the winner's row and replacing it.
     */
    private CheckInResponse writeRaceSafe(Supplier<CheckInResponse> write) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        try {
            return tx.execute(status -> write.get());
        } catch (DataIntegrityViolationException raced) {
            log.info("Check-in write raced a concurrent save; re-reading the slot: {}", raced.getMostSpecificCause().getMessage());
            return tx.execute(status -> write.get());
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

    private CheckInResponse toResponse(CheckInEntity row, CheckInSnapshotEntity snapshot) {
        CheckInResponse response = mapper.toResponse(row);
        response.setSnapshot(mapper.toSnapshot(snapshot));
        return response;
    }

    private static Instant toInstant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }
}
