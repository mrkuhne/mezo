package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectMuteEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectMuteRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** S6 (mezo-d6ivw.6): per-SUBJECT effect silence, outliving the nightly effect_link cache.
 *  {@code forgotten} is permanent — neither a later mute nor an unmute revives it. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class EffectMuteService {

    private final EffectMuteRepository repository;

    @Transactional
    public void mute(UUID userId, String subjectKind, String subjectKey, String mode) {
        EffectMuteEntity row = repository
                .findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(userId, subjectKind, subjectKey)
                .orElseGet(() -> {
                    EffectMuteEntity fresh = new EffectMuteEntity();
                    fresh.setCreatedBy(userId);
                    fresh.setSubjectKind(subjectKind);
                    fresh.setSubjectKey(subjectKey);
                    return fresh;
                });
        if (row.isForgotten()) return;
        row.setMode(mode);
        repository.save(row);
    }

    @Transactional
    public void unmute(UUID userId, String subjectKind, String subjectKey) {
        repository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(userId, subjectKind, subjectKey)
                .filter(row -> !row.isForgotten())
                .ifPresent(repository::delete);
    }
}
