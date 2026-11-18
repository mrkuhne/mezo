package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.feature.train.VolumeProgressionGate;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.mapper.WeekProposalMapper;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The read side of the weekly proposal (volume engine v2 S3, mezo-r36n9.78): {@code GET …/week-proposals}.
 * Opening the review is like opening the day — the week's proposal is generated on demand
 * ({@link VolumeProgressionService#rolloverIfDue}, the same lazy trigger {@code getToday} uses, failure logged
 * and swallowed), then this calendar week's {@code weekly} proposal (any status) and the run's pending
 * {@code tier_change} proposals (newest first) are returned, weekly first.
 *
 * <p>Deliberately not {@code @Transactional}: the generation runs in its own transaction, so a failing weekly
 * engine cannot poison the read.
 */
@Service
@RequiredArgsConstructor
public class WeekProposalQueryService {

    private static final String STATUS_ACTIVE = "active";

    private final MesocycleRepository mesocycleRepository;
    private final MesoWeekProposalRepository proposalRepository;
    private final VolumeProgressionService volumeProgressionService;
    private final WeekProposalMapper mapper;
    private final VolumeProperties props;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;

    /**
     * @throws SystemRuntimeErrorException {@code TRAIN_MESO_NOT_FOUND} (404) for a missing or another user's run
     */
    public List<WeekProposal> open(UUID createdBy, UUID mesoId) {
        MesocycleEntity meso = mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(mesoId, createdBy)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_MESO_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (!STATUS_ACTIVE.equals(meso.getStatus()) || volumeGate.getIfAvailable() == null) {
            return List.of();
        }
        volumeProgressionService.rolloverIfDue(createdBy, meso);

        int calWeek = MesoWeeks.clampWeek(meso.getStartDate(), meso.getWeeks());
        List<MesoWeekProposalEntity> found = new ArrayList<>();
        proposalRepository.findWeekly(createdBy, mesoId, calWeek).ifPresent(found::add);
        found.addAll(proposalRepository.findPendingTierChanges(createdBy, mesoId));
        return toDtos(found, meso);
    }

    /** Maps with the configured mode and the run's tiers (for proposals stored before S3). */
    List<WeekProposal> toDtos(List<MesoWeekProposalEntity> proposals, MesocycleEntity meso) {
        String mode = props.weeklyReview().mode();
        Function<String, String> tierOf = group ->
            PriorityTier.of(meso.getMusclePriorities(), group).name().toLowerCase(Locale.ROOT);
        return proposals.stream().map(p -> mapper.toDto(p, mode, tierOf)).toList();
    }
}
