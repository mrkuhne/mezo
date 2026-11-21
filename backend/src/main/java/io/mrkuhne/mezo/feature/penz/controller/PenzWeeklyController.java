package io.mrkuhne.mezo.feature.penz.controller;

import io.mrkuhne.mezo.api.controller.PenzWeeklyApi;
import io.mrkuhne.mezo.api.dto.PenzWeeklyReviewResponse;
import io.mrkuhne.mezo.feature.penz.service.PenzWeeklyReviewService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** The Pénz weekly long-horizon review (mezo-r36n9.120, tag PenzWeekly) — thin delegation, owner from the principal. */
@RestController
@RequiredArgsConstructor
public class PenzWeeklyController implements PenzWeeklyApi {

    private final PenzWeeklyReviewService reviews;
    private final CurrentUserId currentUserId;

    @Override
    public PenzWeeklyReviewResponse getPenzWeeklyReview(LocalDate week) {
        return reviews.get(currentUserId.get(), week);
    }
}
