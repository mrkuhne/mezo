package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainWeekProposalApi;
import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalDecisionRequest;
import io.mrkuhne.mezo.feature.train.service.WeekProposalDecisionService;
import io.mrkuhne.mezo.feature.train.service.WeekProposalQueryService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Volume engine v2 S3 weekly proposal (mezo-r36n9.78) — mappings come from {@link TrainWeekProposalApi}. */
@RestController
@RequiredArgsConstructor
public class WeekProposalController implements TrainWeekProposalApi {

    private final WeekProposalQueryService queryService;
    private final WeekProposalDecisionService decisionService;
    private final CurrentUserId currentUserId;

    @Override
    public List<WeekProposal> listWeekProposals(UUID id) {
        return queryService.open(currentUserId.get(), id);
    }

    @Override
    public WeekProposal decideWeekProposal(UUID id, UUID proposalId, WeekProposalDecisionRequest request) {
        return decisionService.decide(currentUserId.get(), id, proposalId, request);
    }
}
