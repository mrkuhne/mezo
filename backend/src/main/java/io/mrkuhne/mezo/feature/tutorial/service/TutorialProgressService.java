package io.mrkuhne.mezo.feature.tutorial.service;

import io.mrkuhne.mezo.api.dto.SetTutorialProgressRequest;
import io.mrkuhne.mezo.api.dto.TutorialProgressEntry;
import io.mrkuhne.mezo.api.dto.TutorialProgressResponse;
import io.mrkuhne.mezo.feature.tutorial.entity.TutorialProgressEntity;
import io.mrkuhne.mezo.feature.tutorial.entity.TutorialProgressEntryJson;
import io.mrkuhne.mezo.feature.tutorial.repository.TutorialProgressRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.TUTORIAL_SWITCH, havingValue = "true")
public class TutorialProgressService {

    private final TutorialProgressRepository repository;

    /** Empty-map ghost when nothing was ever seen — never 404. */
    public TutorialProgressResponse getProgress(UUID userId) {
        Map<String, TutorialProgressEntry> out = new LinkedHashMap<>();
        repository.findByCreatedByAndDeletedFalse(userId)
            .ifPresent(e -> e.getProgress().forEach((k, v) -> out.put(k, toDto(v))));
        return TutorialProgressResponse.builder().progress(out).build();
    }

    /** Whole-map replace (the client owns the merge; see spec §6 "Írás-sorrend"). */
    @Transactional
    public TutorialProgressResponse setProgress(UUID userId, SetTutorialProgressRequest req) {
        TutorialProgressEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                TutorialProgressEntity e = new TutorialProgressEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        Map<String, TutorialProgressEntryJson> json = new LinkedHashMap<>();
        req.getProgress().forEach((k, v) -> json.put(k, toJson(v)));
        row.setProgress(json);
        repository.save(row);
        return getProgress(userId);
    }

    /** Soft-deletes the live row; the partial-unique index lets the next PUT create a fresh one. */
    @Transactional
    public void resetProgress(UUID userId) {
        repository.findByCreatedByAndDeletedFalse(userId).ifPresent(repository::delete);
    }

    private static TutorialProgressEntryJson toJson(TutorialProgressEntry d) {
        return new TutorialProgressEntryJson(
            d.getVersion(),
            d.getSeenAt().toString(),
            d.getCompletedAt() == null ? null : d.getCompletedAt().toString(),
            d.getDismissedAtStep());
    }

    private static TutorialProgressEntry toDto(TutorialProgressEntryJson j) {
        return TutorialProgressEntry.builder()
            .version(j.getVersion())
            .seenAt(OffsetDateTime.parse(j.getSeenAt()))
            .completedAt(j.getCompletedAt() == null ? null : OffsetDateTime.parse(j.getCompletedAt()))
            .dismissedAtStep(j.getDismissedAtStep())
            .build();
    }
}
