package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailItemRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMessageRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailRunRepository;
import io.mrkuhne.mezo.feature.mail.service.MailDigest.ItemView;
import io.mrkuhne.mezo.feature.mail.service.MailDigest.RestGroup;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Answers the morning-post digest query (spec §4.1, §10.1–§10.3, mezo-r36n9.39). Read-only; every number is counted
 * from stored rows. The lists are the OPEN items — still before their {@code open_until} at the query's anchor
 * (now for today, the day's end for a past day) and first seen before the day's end; the counts cover the Budapest
 * day. A sensitive card carries the sender only.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailDigestQuery {

    private static final int SLOTS = 12;

    private final MailItemRepository items;
    private final MailMessageRepository messages;
    private final MailMailboxRepository mailboxes;
    private final MailRunRepository runs;
    private final MailProperties properties;

    public MailDigest digest(UUID user, LocalDate day, Instant now) {
        ZoneId zone = ZoneId.of(properties.zone());
        Instant dayStart = day.atStartOfDay(zone).toInstant();
        Instant dayEnd = day.plusDays(1).atStartOfDay(zone).toInstant();
        Instant anchor = now.isBefore(dayEnd) && !now.isBefore(dayStart) ? now : dayEnd;

        List<MailMessageEntity> arrivals = messages
            .findByCreatedByAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByReceivedAtAsc(user, dayStart, dayEnd);
        int[] heat = new int[SLOTS];
        for (MailMessageEntity m : arrivals) {
            int hour = m.getReceivedAt().atZone(zone).getHour();
            heat[Math.min(SLOTS - 1, hour / 2)]++;
        }

        List<MailItemEntity> open = items.open(user, anchor, dayEnd);
        Map<UUID, MailMessageEntity> byMessage = messages
            .findAllById(open.stream().map(MailItemEntity::getMessageId).distinct().toList()).stream()
            .collect(Collectors.toMap(MailMessageEntity::getId, Function.identity()));

        List<ItemView> people = new ArrayList<>();
        List<ItemView> sensitive = new ArrayList<>();
        List<ItemView> deadlines = new ArrayList<>();
        List<ItemView> parcels = new ArrayList<>();
        List<ItemView> deals = new ArrayList<>();
        Map<String, Integer> rest = new TreeMap<>();
        int worth = 0;
        for (MailItemEntity i : open) {
            MailMessageEntity m = byMessage.get(i.getMessageId());
            if (m == null) {
                continue;
            }
            ItemView view = view(i, m, now, zone);
            boolean today = !i.getStateChangedAt().isBefore(dayStart) && i.getStateChangedAt().isBefore(dayEnd);
            switch (i.getGrp()) {
                case "person" -> {
                    people.add(view);
                    worth += today ? 1 : 0;
                }
                case "sensitive" -> {
                    sensitive.add(view);
                    worth += today ? 1 : 0;
                }
                case "deadline" -> {
                    deadlines.add(view);
                    worth += today ? 1 : 0;
                }
                case "parcel" -> {
                    parcels.add(view);
                    worth += today ? 1 : 0;
                }
                case "deal" -> {
                    deals.add(view);
                    boolean worthIt = i.getScore() != null && i.getScore() >= properties.dealWorthThreshold()
                        && !"flagged".equals(i.getScreen());
                    worth += today && worthIt ? 1 : 0;
                }
                default -> {
                    if (!m.getCreatedAt().isBefore(dayStart) && m.getCreatedAt().isBefore(dayEnd)) {
                        rest.merge(i.getCategory(), 1, Integer::sum); // "A többi" follows the fetch, like arrived
                    }
                }
            }
        }
        people.sort(Comparator.comparing(ItemView::receivedAt).reversed());
        sensitive.sort(Comparator.comparing(ItemView::receivedAt).reversed());
        deadlines.sort(Comparator.comparing(ItemView::dueAt, Comparator.nullsLast(Comparator.naturalOrder())));
        parcels.sort(Comparator.comparing(ItemView::stateChangedAt).reversed());
        deals.sort(Comparator.comparing(ItemView::score, Comparator.nullsLast(Comparator.reverseOrder())));
        List<RestGroup> restGroups = rest.entrySet().stream()
            .map(e -> new RestGroup(e.getKey(), e.getValue()))
            .sorted(Comparator.comparingInt(RestGroup::count).reversed()).toList();

        MailMailboxEntity mailbox = mailboxes.findByCreatedBy(user).orElse(null);
        MailRunEntity limited = runs
            .findFirstByCreatedByAndRulesOnlyTrueAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtDesc(
                user, dayStart, dayEnd).orElse(null);
        int arrived = arrivals.size();
        return new MailDigest(mailbox == null ? null : mailbox.getLastRunAt(),
            mailbox == null ? MailIntakeStore.STATE_DISCONNECTED : mailbox.getState(), limited != null,
            limited == null ? null : limited.getRulesOnlyReason(), arrived, worth,
            Math.max(0, arrived - worth), heat, people, sensitive, deadlines, parcels, deals, restGroups);
    }

    private ItemView view(MailItemEntity i, MailMessageEntity m, Instant now, ZoneId zone) {
        String sender = m.getFromName() == null || m.getFromName().isBlank() ? m.getFromAddr() : m.getFromName();
        boolean sensitive = "sensitive".equals(i.getGrp());
        return new ItemView(i.getId(), i.getGrp(), i.getCategory(), sensitive ? sender : i.getTitle(),
            sensitive ? "" : i.getSummary(), sensitive ? "" : i.getWhy(),
            i.getScore() == null ? null : i.getScore().intValue(), i.getDueAt(), i.getValidUntil(),
            i.getAmountMinor(), i.getCurrency(), i.getCarrier(), i.getParcelState(), i.getStateChangedAt(),
            i.getScreen(), "flagged".equals(i.getScreen()), notifiable(i, now, zone), m.getFromName(), m.getFromAddr(), m.getVia(), m.getReceivedAt(),
            m.getGmMsgid());
    }

    /**
     * A deal scoring at least the notify threshold, cleared by the screen ({@code clean}; none / unknown / flagged
     * never notify), whose valid-until is ahead and within the notify window; or a deadline still ahead and due
     * today or tomorrow (Budapest) — a rule-sourced one needs no screen, any other (model, JSON-LD: sender-controlled)
     * only once {@code clean}.
     */
    private boolean notifiable(MailItemEntity i, Instant now, ZoneId zone) {
        boolean clean = "clean".equals(i.getScreen());
        switch (i.getGrp()) {
            case "deal" -> {
                Instant until = i.getValidUntil();
                return clean && i.getScore() != null && i.getScore() >= properties.notifyThreshold() && until != null
                    && until.isAfter(now) && !until.isAfter(now.plus(Duration.ofHours(properties.notifyWindowHours())));
            }
            case "deadline" -> {
                if (i.getDueAt() == null || !i.getDueAt().isAfter(now) || !(clean || "rule".equals(i.getSource()))) {
                    return false; // a due time that has passed no longer rings
                }
                LocalDate due = i.getDueAt().atZone(zone).toLocalDate();
                LocalDate today = now.atZone(zone).toLocalDate();
                return !due.isBefore(today) && !due.isAfter(today.plusDays(1));
            }
            default -> {
                return false;
            }
        }
    }
}
