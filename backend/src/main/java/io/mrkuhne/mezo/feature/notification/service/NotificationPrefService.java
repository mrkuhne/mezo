package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.domain.CategoryPref;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.entity.NotificationPrefEntity;
import io.mrkuhne.mezo.feature.notification.repository.NotificationPrefRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-category notification preferences (bd mezo-h4wp.6.2). A missing {@code notification_pref}
 * row is never "off" — it reports the category's code default ({@link NotificationCategory}) —
 * so a newly added category ships with its intended default and a fresh install needs no seed
 * data.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class NotificationPrefService {

    private final NotificationPrefRepository prefRepository;

    /** All 23 categories, always — a stored row wins, a missing one reports the code default. */
    public List<CategoryPref> effectiveFor(UUID owner) {
        Map<String, NotificationPrefEntity> stored = prefRepository.findByCreatedBy(owner).stream()
            .collect(Collectors.toMap(NotificationPrefEntity::getCategory, Function.identity()));
        return Arrays.stream(NotificationCategory.values())
            .map(category -> {
                NotificationPrefEntity row = stored.get(category.key());
                return row == null
                    ? new CategoryPref(category, category.defaultEnabled(), category.defaultLeadMinutes())
                    : new CategoryPref(category, row.isEnabled(), row.getLeadMinutes());
            })
            .toList();
    }

    /** Per-category upsert — a blind insert would throw on the partial unique index. */
    @Transactional
    public void upsert(UUID owner, List<CategoryPref> prefs) {
        for (CategoryPref pref : prefs) {
            NotificationPrefEntity entity = prefRepository
                .findByCreatedByAndCategory(owner, pref.category().key())
                .orElseGet(() -> {
                    NotificationPrefEntity fresh = new NotificationPrefEntity();
                    fresh.setCreatedBy(owner);
                    fresh.setCategory(pref.category().key());
                    return fresh;
                });
            entity.setEnabled(pref.enabled());
            entity.setLeadMinutes(pref.leadMinutes());
            prefRepository.save(entity);
        }
    }
}
