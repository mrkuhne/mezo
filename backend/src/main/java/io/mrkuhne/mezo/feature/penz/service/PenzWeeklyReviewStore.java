package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklyReviewEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklySectionJson;
import io.mrkuhne.mezo.feature.penz.repository.PenzWeeklyReviewRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes and reads the owner's weekly review row (mezo-r36n9.120). Its own bean so the write is one short transaction
 * that never spans the LLM call of {@link PenzWeeklyReviewService#build}.
 */
@Service
@RequiredArgsConstructor
public class PenzWeeklyReviewStore {

    private final PenzWeeklyReviewRepository reviews;

    /** Stores the owner's review of {@code weekStart}: any old row of that week is removed first, atomically. */
    @Transactional
    public PenzWeeklyReviewEntity replace(UUID owner, LocalDate weekStart, String status,
                                          List<PenzWeeklySectionJson> sections, Instant generatedAt) {
        reviews.purgeWeek(owner, weekStart);
        PenzWeeklyReviewEntity row = new PenzWeeklyReviewEntity();
        row.setCreatedBy(owner);
        row.setWeekStart(weekStart);
        row.setStatus(status);
        row.setSections(new ArrayList<>(sections));
        row.setGeneratedAt(generatedAt);
        row.setUpdatedAt(generatedAt);
        return reviews.saveAndFlush(row);
    }

    public Optional<PenzWeeklyReviewEntity> find(UUID owner, LocalDate weekStart) {
        return reviews.findByCreatedByAndWeekStartAndDeletedFalse(owner, weekStart);
    }

    public Optional<PenzWeeklyReviewEntity> latest(UUID owner) {
        return reviews.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(owner);
    }
}
