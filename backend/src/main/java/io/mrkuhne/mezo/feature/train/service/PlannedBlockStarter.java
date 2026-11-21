package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.port.SeasonGatePort;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A planned block starts on its day (mezo-r36n9.113, controller call 1): nothing else ever promotes a
 * {@code planned} mesocycle, so the today-workout, mesocycle-list and year-plan reads call {@link #startDue} first.
 * The latest-starting planned run whose start is on/before today — and after the running run's start, so a stale
 * older planned run never takes over — is activated through
 * {@link TrainService#activateMesocycle} (which archives the running one) — but only when the season gate allows it;
 * otherwise it simply stays planned, never an error on a read. Depends on {@code TrainService} only; TrainService never
 * calls back (no bean cycle).
 */
@Service
@RequiredArgsConstructor
public class PlannedBlockStarter {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");
    private static final String ACTIVE = "active";
    private static final String PLANNED = "planned";

    private final MesocycleRepository mesocycles;
    private final TrainService trainService;
    private final SeasonGatePort seasonGate;
    private final ObjectProvider<Clock> clock;

    @Transactional
    public void startDue(UUID owner) {
        LocalDate today = LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(ZONE));
        // Only a run that starts after the running one; an older overdue planned run is stale and left alone.
        LocalDate after = mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, ACTIVE).stream()
            .map(MesocycleEntity::getStartDate).filter(Objects::nonNull)
            .max(Comparator.naturalOrder()).orElse(null);
        mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, PLANNED).stream()
            .filter(m -> m.getStartDate() != null && !m.getStartDate().isAfter(today))
            .filter(m -> after == null || m.getStartDate().isAfter(after))
            .max(Comparator.comparing(MesocycleEntity::getStartDate))
            .filter(m -> seasonGate.allowsMesocycleStart(owner, m.getStartDate()))
            .ifPresent(m -> activateIfStillPlanned(owner, m.getId()));
    }

    /**
     * Parallel reads on a start day race here: the row lock serialises them, and the status is re-read from the
     * database (a scalar query, not the entity this transaction already holds) after the lock, so only the first one
     * activates — one volume-log sync, one {@code MesocycleActivated}.
     */
    private void activateIfStillPlanned(UUID owner, UUID id) {
        if (mesocycles.findLockedByIdAndCreatedByAndDeletedFalse(id, owner).isEmpty()) return;
        if (!PLANNED.equals(mesocycles.findStatusById(id))) return;
        trainService.activateMesocycle(owner, id);
    }
}
