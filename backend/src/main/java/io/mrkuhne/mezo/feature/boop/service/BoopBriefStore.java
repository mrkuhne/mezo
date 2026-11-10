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
     * Inserts or overwrites the day's brief. {@code manual} = a user-asked regeneration: it is
     * re-checked against {@code regenLimit} here (the service already refused before the LLM call;
     * this closes the gap of two regenerations racing past that check) and counted.
     */
    @Transactional
    public void upsert(UUID owner, LocalDate date, String inputHash, String payload, Instant generatedAt,
                       boolean manual, int regenLimit) {
        BoopBriefEntity row = briefs.findByCreatedByAndDate(owner, date).orElseGet(() -> {
            BoopBriefEntity e = new BoopBriefEntity();
            e.setCreatedBy(owner);
            e.setDate(date);
            return e;
        });
        if (manual) {
            if (row.getRegenCount() >= regenLimit) {
                throw limitReached();
            }
            row.setRegenCount(row.getRegenCount() + 1);
        }
        row.setInputHash(inputHash);
        row.setPayload(payload);
        row.setGeneratedAt(generatedAt);
        briefs.saveAndFlush(row);
    }

    static SystemRuntimeErrorException limitReached() {
        return new SystemRuntimeErrorException(SystemMessage.error(REGEN_LIMIT_CODE).build(), HttpStatus.CONFLICT);
    }
}
