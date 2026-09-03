package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists a stale-race supersede independently of the caller's own transaction (spec §6.8,
 * mezo-ktg8 final-review finding 1). {@link GoalSuggestionService#accept} detects a stale
 * suggestion (the snapshot trajectory no longer matches the goal) and must return a 409 to the
 * caller — but the 409 is thrown as a {@code RuntimeException}, which rolls back {@code accept}'s
 * own {@code @Transactional}. Without a REQUIRES_NEW write, the supersede itself rolled back with
 * it, leaving the row {@code 'proposed'} forever (dismiss became the only escape — a 409 the card
 * could never recover from). This bean's REQUIRES_NEW transaction commits the supersede on its
 * own connection BEFORE {@code accept} throws.
 *
 * <p>Deliberately a SEPARATE Spring bean rather than a package-private {@code @Transactional}
 * method on {@code GoalSuggestionService} itself: Spring's transactional proxy only intercepts
 * calls that arrive through the bean's proxy, and a same-class self-invocation
 * ({@code this.markSuperseded(...)}) bypasses the proxy entirely — the REQUIRES_NEW annotation
 * would silently do nothing. This mirrors the codebase's established REQUIRES_NEW idiom
 * ({@code CharacterRunLog}, {@code AppNotificationService}) for the identical reason.
 *
 * <p><b>Lock safety (the deadlock trap this fix is careful to avoid):</b> a REQUIRES_NEW write
 * from inside a still-open transaction that already holds a lock on the SAME row hangs forever —
 * the suspended outer transaction keeps the row locked on its own connection while this bean's
 * fresh connection blocks waiting for that lock, and neither can proceed until the other finishes.
 * {@code accept}'s outer transaction must therefore only ever SELECT the suggestion row before
 * calling this (no row lock under READ_COMMITTED) and must NEVER write to it in the stale-race
 * branch — this bean re-loads the row fresh on its own connection and is its only writer on that
 * path, so there is no lock contention with the still-open caller.
 */
@Service
class GoalSuggestionSupersedeWriter {

    private final GoalSuggestionRepository suggestionRepository;

    GoalSuggestionSupersedeWriter(GoalSuggestionRepository suggestionRepository) {
        this.suggestionRepository = suggestionRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void markSuperseded(UUID suggestionId) {
        suggestionRepository.findById(suggestionId).ifPresent(row -> {
            row.setStatus(GoalSuggestionService.STATUS_SUPERSEDED);
            row.setDecidedAt(Instant.now());
            suggestionRepository.save(row);
        });
    }
}
