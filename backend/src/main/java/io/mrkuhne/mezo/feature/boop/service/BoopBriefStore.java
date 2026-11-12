package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.feature.boop.entity.BoopBriefEntity;
import io.mrkuhne.mezo.feature.boop.repository.BoopBriefRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The write half of the Boop brief (Boop S3, mezo-r36n9.7): the one {@code boop_brief} row per
 * owner and day. A separate bean so {@link BoopBriefService} generates (LLM call) OUTSIDE any
 * transaction and only this short upsert runs in one — a self-invoked {@code @Transactional}
 * method on the service would bypass the proxy.
 */
@Service
@RequiredArgsConstructor
public class BoopBriefStore {

    static final String REGEN_LIMIT_CODE = "BOOP_REGENERATE_LIMIT_REACHED";

    private final BoopBriefRepository briefs;

    /**
     * Inserts or overwrites the day's brief. {@code manual} = a user-asked regeneration: on an
     * existing row it is counted with one atomic capped UPDATE ({@link BoopBriefRepository#incrementRegen}
     * — two regenerations racing past the service's pre-check cannot both win the last slot); a new
     * row starts at 1. {@code regen_count} is not updatable through the entity, so the payload rewrite
     * of a GET never writes back a count it read before a concurrent regeneration committed.
     *
     * <p>Two racing first writes of the same day: one INSERT loses on {@code uq_boop_brief_user_date}
     * with a {@code DataIntegrityViolationException}; {@link BoopBriefService} handles that outside
     * this (then rolled back) transaction.
     */
    @Transactional
    public void upsert(UUID owner, LocalDate date, String inputHash, String payload, Instant generatedAt,
                       boolean aiWords, boolean manual, int regenLimit) {
        BoopBriefEntity row = briefs.findByCreatedByAndDate(owner, date).orElse(null);
        if (row == null) {
            row = new BoopBriefEntity();
            row.setCreatedBy(owner);
            row.setDate(date);
            row.setRegenCount(manual ? 1 : 0);
            if (manual && regenLimit < 1) {
                throw limitReached();
            }
        } else if (manual) {
            if (briefs.incrementRegen(owner, date, regenLimit) == 0) {
                throw limitReached();
            }
            row = briefs.findByCreatedByAndDate(owner, date).orElseThrow(); // fresh: the update cleared the context
        }
        row.setInputHash(inputHash);
        row.setPayload(payload);
        row.setGeneratedAt(generatedAt);
        row.setAiWords(aiWords);
        briefs.saveAndFlush(row);
    }

    /** The model's late words onto the rule-only row of the same inputs; false = the row moved on. */
    @Transactional
    public boolean fillWords(UUID owner, LocalDate date, String inputHash, String payload, Instant generatedAt) {
        return briefs.fillWords(owner, date, inputHash, payload, generatedAt) == 1;
    }

    static SystemRuntimeErrorException limitReached() {
        return new SystemRuntimeErrorException(SystemMessage.error(REGEN_LIMIT_CODE).build(), HttpStatus.CONFLICT);
    }
}
