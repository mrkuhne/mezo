package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailItemRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMessageRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailRunRepository;
import io.mrkuhne.mezo.feature.mail.service.classify.ScreenVerdict;
import io.mrkuhne.mezo.feature.mail.service.rules.ParcelState;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The writes of the digest pipeline (mezo-r36n9.39), each one short transaction — every model call happens BEFORE or
 * AFTER, never inside. A model-sourced deal or deadline is stored {@code flagged} until its screen answers CLEAN
 * (fail-closed: a crash between two steps can never leave an unscreened item notifiable).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailItemStore {

    static final Duration DEAL_DEFAULT_OPEN = Duration.ofDays(3);
    static final Duration PARCEL_OPEN = Duration.ofDays(14);
    static final Duration DAY = Duration.ofDays(1);

    private final MailItemRepository items;
    private final MailMessageRepository messages;
    private final MailRunRepository runs;

    /**
     * One item to store. {@code parcelState} and {@code carrier}/{@code parcelKey} are set together for a parcel
     * (the unique index ignores a null carrier). {@code pendingScreen} stores it flagged until the screen clears it.
     */
    public record NewItem(UUID owner, UUID messageId, UUID runId, String grp, String category, String title,
                          String summary, Instant dueAt, Instant validUntil, Long amountMinor, String currency,
                          String carrier, String parcelKey, ParcelState parcelState, String source,
                          boolean pendingScreen, Instant now) {
    }

    /** The stored item's id, and whether this call created a row (false = an existing parcel row was reused). */
    public record Saved(UUID id, boolean created) {
    }

    /** When an item stops being listed (spec §10.1, brief Task 8). */
    static Instant openUntil(String grp, Instant dueAt, Instant validUntil, ParcelState parcelState,
                             Instant stateChangedAt, Instant now) {
        return switch (grp) {
            case "deadline" -> (dueAt == null ? now : dueAt).plus(DAY);
            case "parcel" -> parcelState == ParcelState.DELIVERED ? stateChangedAt.plus(DAY)
                : stateChangedAt.plus(PARCEL_OPEN);
            case "deal" -> validUntil != null ? validUntil : now.plus(DEAL_DEFAULT_OPEN);
            default -> now.plus(DAY);
        };
    }

    static String column(ParcelState state) {
        return state == null ? null : state.name().toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public boolean hasItem(UUID messageId) {
        return items.existsByMessageId(messageId);
    }

    @Transactional(readOnly = true)
    public boolean parcelExists(UUID owner, String carrier, String parcelKey) {
        return items.findByCreatedByAndCarrierAndParcelKey(owner, carrier, parcelKey).isPresent();
    }

    /** Today's messages that never got an item, oldest first. */
    @Transactional(readOnly = true)
    public List<MailMessageEntity> withoutItem(UUID owner, Instant since) {
        return messages.withoutItem(owner, since);
    }

    @Transactional(readOnly = true)
    public Map<UUID, MailMessageEntity> messages(Collection<UUID> ids) {
        return messages.findAllById(ids).stream().collect(Collectors.toMap(MailMessageEntity::getId,
            Function.identity()));
    }

    /**
     * Stores one item. A parcel upserts on {@code (carrier, parcel_key)}: a new state updates the one row and moves
     * {@code state_changed_at}; the same state touches nothing; a delivered parcel never goes back.
     */
    @Transactional
    public Saved save(NewItem n) {
        if (n.parcelKey() != null && n.carrier() != null) {
            Optional<MailItemEntity> existing = items.findByCreatedByAndCarrierAndParcelKey(n.owner(), n.carrier(),
                n.parcelKey());
            if (existing.isPresent()) {
                MailItemEntity e = existing.get();
                String next = column(n.parcelState());
                if (next != null && !next.equals(e.getParcelState()) && !"delivered".equals(e.getParcelState())) {
                    e.setParcelState(next);
                    e.setStateChangedAt(n.now());
                    e.setOpenUntil(openUntil("parcel", null, null, n.parcelState(), n.now(), n.now()));
                    items.saveAndFlush(e);
                }
                return new Saved(e.getId(), false);
            }
        }
        MailItemEntity e = new MailItemEntity();
        e.setCreatedBy(n.owner());
        e.setMessageId(n.messageId());
        e.setGrp(n.grp());
        e.setCategory(n.category());
        e.setTitle(n.title());
        e.setSummary(n.summary());
        e.setWhy("");
        e.setDueAt(n.dueAt());
        e.setValidUntil(n.validUntil());
        e.setAmountMinor(n.amountMinor());
        e.setCurrency(n.currency());
        e.setCarrier(n.carrier());
        e.setParcelKey(n.parcelKey());
        e.setParcelState(column(n.parcelState()));
        e.setStateChangedAt(n.now());
        e.setOpenUntil(openUntil(n.grp(), n.dueAt(), n.validUntil(), n.parcelState(), n.now(), n.now()));
        e.setFlagged(n.pendingScreen());
        e.setSource(n.source());
        e.setFirstSeenRun(n.runId());
        return new Saved(items.saveAndFlush(e).getId(), true);
    }

    /** The relevance score and its one line; an item worth a minute stays flagged until its screen clears it. */
    @Transactional
    public void applyScore(UUID itemId, int score, String why, boolean pendingScreen) {
        items.findById(itemId).ifPresent(e -> {
            e.setScore((short) score);
            e.setWhy(why == null ? "" : why);
            e.setFlagged(pendingScreen);
            items.saveAndFlush(e);
        });
    }

    /** Stores the screen's verdict: only CLEAN lifts the flag (FLAGGED and UNKNOWN both keep it). */
    @Transactional
    public void applyScreen(UUID itemId, ScreenVerdict verdict) {
        items.findById(itemId).ifPresent(e -> {
            e.setFlagged(verdict != ScreenVerdict.CLEAN);
            items.saveAndFlush(e);
        });
    }

    /** Records how the run's processing went. */
    @Transactional
    public void finishRun(UUID runId, int classified, boolean rulesOnly) {
        runs.findById(runId).ifPresent(r -> {
            r.setClassified(classified);
            r.setRulesOnly(rulesOnly);
            runs.saveAndFlush(r);
        });
    }
}
