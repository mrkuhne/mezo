package io.mrkuhne.mezo.feature.capacity.controller;

import io.mrkuhne.mezo.api.controller.CapacityApi;
import io.mrkuhne.mezo.api.dto.CapacityAdjustment;
import io.mrkuhne.mezo.api.dto.CapacityEventFeedbackRequest;
import io.mrkuhne.mezo.api.dto.CapacityProposal;
import io.mrkuhne.mezo.api.dto.CapacityProposalAcceptRequest;
import io.mrkuhne.mezo.api.dto.CapacitySeasonLoad;
import io.mrkuhne.mezo.api.dto.CapacityWeek;
import io.mrkuhne.mezo.feature.capacity.mapper.CapacityAdjustmentMapper;
import io.mrkuhne.mezo.feature.capacity.mapper.CapacityProposalMapper;
import io.mrkuhne.mezo.feature.capacity.mapper.CapacitySeasonMapper;
import io.mrkuhne.mezo.feature.capacity.service.DayAdjustmentService;
import io.mrkuhne.mezo.feature.capacity.service.EventFeedbackService;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/capacity surface (Boop B7, mezo-r36n9.17) — thin delegation, ownership from the principal. */
@RestController
@RequiredArgsConstructor
public class CapacityController implements CapacityApi {

    private final EventFeedbackService feedbackService;
    private final SeasonLoadService seasonLoadService;
    private final DayAdjustmentService adjustments;
    private final ProposalService proposals;
    private final CurrentUserId currentUserId;

    @Override
    public void putCapacityEventFeedback(CapacityEventFeedbackRequest request) {
        feedbackService.label(currentUserId.get(), request.getEventKey(),
            request.getEffect() == null ? null : request.getEffect().getValue());
    }

    @Override
    public CapacitySeasonLoad getCapacitySeason() {
        return CapacitySeasonMapper.toDto(seasonLoadService.read(currentUserId.get()));
    }

    @Override
    public List<CapacityAdjustment> listCapacityAdjustments(LocalDate from, LocalDate to) {
        return adjustments.list(currentUserId.get(), from, to).stream().map(CapacityAdjustmentMapper::toDto).toList();
    }

    @Override
    public void undoCapacityAdjustment(UUID id) {
        adjustments.undo(currentUserId.get(), id);
    }

    @Override
    public CapacityWeek getCapacityWeek(LocalDate monday) {
        return CapacityProposalMapper.toDto(proposals.week(currentUserId.get(), monday));
    }

    @Override
    public CapacityWeek regenerateCapacityProposals(LocalDate monday) {
        return CapacityProposalMapper.toDto(proposals.regenerate(currentUserId.get(), monday));
    }

    @Override
    public List<CapacityAdjustment> acceptCapacityProposal(UUID id, CapacityProposalAcceptRequest request) {
        return proposals.accept(currentUserId.get(), id, request.getClientRef()).stream()
            .map(CapacityAdjustmentMapper::toDto).toList();
    }

    @Override
    public CapacityProposal declineCapacityProposal(UUID id) {
        return CapacityProposalMapper.toDto(proposals.decline(currentUserId.get(), id));
    }
}
