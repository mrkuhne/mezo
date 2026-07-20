package io.mrkuhne.mezo.feature.intention.service;

import io.mrkuhne.mezo.api.dto.IntentionCreedResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.feature.intention.config.IntentionProperties;
import io.mrkuhne.mezo.feature.intention.entity.DailyIntentionEntity;
import io.mrkuhne.mezo.feature.intention.entity.IntentionCreedEntity;
import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import io.mrkuhne.mezo.feature.intention.mapper.IntentionMapper;
import io.mrkuhne.mezo.feature.intention.repository.DailyIntentionRepository;
import io.mrkuhne.mezo.feature.intention.repository.IntentionCreedRepository;
import io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily intention lifecycle (bd mezo-a686): a standing creed (upsert to a single live row per owner),
 * up to a configured cap of daily foci (add/remove, ordered by creation), and a holistic evening
 * reflection (upsert per owner × day). Text is stripped, blank-rejected, and truncated to the
 * configured limit. Gated {@code INTENTION_SWITCH}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.INTENTION_SWITCH, havingValue = "true")
public class IntentionService {

    private static final Set<String> REFLECTIONS = Set.of(
        DailyIntentionEntity.REFLECTION_YES,
        DailyIntentionEntity.REFLECTION_PARTIAL,
        DailyIntentionEntity.REFLECTION_NO);

    private final IntentionCreedRepository creedRepository;
    private final IntentionFocusRepository focusRepository;
    private final DailyIntentionRepository dailyRepository;
    private final IntentionMapper mapper;
    private final IntentionProperties properties;

    @Transactional(readOnly = true)
    public IntentionDayResponse getDay(UUID userId, LocalDate date) {
        String creed = creedRepository.findByCreatedByAndDeletedFalse(userId)
            .map(IntentionCreedEntity::getText).orElse(null);
        List<IntentionFocusResponse> foci = focusRepository
            .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(userId, date)
            .stream().map(mapper::toResponse).toList();
        String reflection = dailyRepository.findByCreatedByAndIntentionDateAndDeletedFalse(userId, date)
            .map(DailyIntentionEntity::getReflection).orElse(null);
        return IntentionDayResponse.builder()
            .date(date).creed(creed).foci(foci)
            .reflection(reflection == null ? null
                : IntentionDayResponse.ReflectionEnum.fromValue(reflection))
            .focusCap(properties.focusCap())
            .build();
    }

    @Transactional
    public IntentionCreedResponse setCreed(UUID userId, String text) {
        String t = requireText(text, properties.creedMaxLen());
        IntentionCreedEntity row = creedRepository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                IntentionCreedEntity e = new IntentionCreedEntity();
                e.setCreatedBy(userId);
                return e;
            });
        row.setText(t);
        creedRepository.save(row);
        return IntentionCreedResponse.builder().text(t).build();
    }

    @Transactional
    public IntentionFocusResponse addFocus(UUID userId, LocalDate date, String text) {
        String t = requireText(text, properties.focusMaxLen());
        long count = focusRepository
            .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(userId, date).size();
        if (count >= properties.focusCap()) {
            throw conflict("INTENTION_FOCUS_CAP");
        }
        IntentionFocusEntity e = new IntentionFocusEntity();
        e.setCreatedBy(userId);
        e.setFocusDate(date);
        e.setText(t);
        return mapper.toResponse(focusRepository.saveAndFlush(e));
    }

    @Transactional
    public void removeFocus(UUID userId, UUID focusId) {
        IntentionFocusEntity e = focusRepository.findByIdAndCreatedByAndDeletedFalse(focusId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("INTENTION_FOCUS_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        focusRepository.delete(e); // @SQLDelete → soft delete
    }

    @Transactional
    public IntentionDayResponse reflect(UUID userId, LocalDate date, String value) {
        if (value == null || !REFLECTIONS.contains(value)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("INTENTION_REFLECTION_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
        DailyIntentionEntity row = dailyRepository
            .findByCreatedByAndIntentionDateAndDeletedFalse(userId, date)
            .orElseGet(() -> {
                DailyIntentionEntity e = new DailyIntentionEntity();
                e.setCreatedBy(userId);
                e.setIntentionDate(date);
                return e;
            });
        row.setReflection(value);
        dailyRepository.save(row);
        return getDay(userId, date);
    }

    private String requireText(String text, int maxLen) {
        String t = text == null ? "" : text.strip();
        if (t.isEmpty()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("INTENTION_TEXT_REQUIRED").build(), HttpStatus.BAD_REQUEST);
        }
        return t.length() > maxLen ? t.substring(0, maxLen) : t;
    }

    private SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }
}
