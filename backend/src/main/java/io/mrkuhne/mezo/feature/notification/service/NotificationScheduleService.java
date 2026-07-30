package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.domain.ScheduleEntry;
import io.mrkuhne.mezo.feature.notification.entity.NotificationScheduleEntity;
import io.mrkuhne.mezo.feature.notification.repository.NotificationScheduleRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The FE-written recurring notification schedule (bd mezo-h4wp.6.3) — the snapshot the client
 * PUTs for a category with no backend anchor ({@link NotificationCategory#feWritten()}).
 * Maintained via full replace per named category: soft-delete the category's live rows, then
 * insert the new set (a soft-deleted row never blocks reinsertion — the same idiom as
 * {@code GymScheduleService.replaceSchedule}).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class NotificationScheduleService {

    private final NotificationScheduleRepository scheduleRepository;

    /**
     * Replaces the live schedule for every category named in {@code categories} with the
     * entries in {@code entries} whose {@code category()} matches — a category named with no
     * matching entries is thereby cleared. Only {@link NotificationCategory#feWritten()}
     * categories are accepted (checked on both {@code categories} and every entry's category):
     * letting a client write a backend-native category's schedule (gym, ritual, …) would create
     * a second source of truth for a minute the backend already owns.
     */
    @Transactional
    public void replace(UUID owner, List<String> categories, List<ScheduleEntry> entries) {
        for (String category : categories) {
            requireFeWritten(category);
        }
        for (ScheduleEntry entry : entries) {
            requireFeWritten(entry.category());
        }
        for (String category : categories) {
            scheduleRepository.deleteAll(scheduleRepository.findByCreatedByAndCategory(owner, category));
        }
        for (ScheduleEntry entry : entries) {
            NotificationScheduleEntity e = new NotificationScheduleEntity();
            e.setCreatedBy(owner);
            e.setWeekday(entry.weekday());
            e.setTime(entry.time());
            e.setCategory(entry.category());
            e.setTitle(entry.title());
            e.setBody(entry.body());
            e.setDeeplink(entry.deeplink());
            e.setSource(entry.source());
            scheduleRepository.save(e);
        }
    }

    /** Every live schedule entry for the owner, across all categories — the dispatcher's read. */
    public List<ScheduleEntry> liveFor(UUID owner) {
        return scheduleRepository.findByCreatedBy(owner).stream()
            .map(e -> new ScheduleEntry(e.getWeekday(), e.getTime(), e.getCategory(), e.getTitle(),
                e.getBody(), e.getDeeplink(), e.getSource()))
            .toList();
    }

    private static void requireFeWritten(String category) {
        NotificationCategory resolved = NotificationCategory.fromKey(category).orElseThrow(
            NotificationScheduleService::unknownCategory);
        if (!resolved.feWritten()) {
            throw unknownCategory();
        }
    }

    private static SystemRuntimeErrorException unknownCategory() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("NOTIFICATION_UNKNOWN_CATEGORY").build(), HttpStatus.BAD_REQUEST);
    }
}
