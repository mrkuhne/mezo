package io.mrkuhne.mezo.feature.intention.mapper;

import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import org.springframework.stereotype.Component;

@Component
public class IntentionMapper {
    public IntentionFocusResponse toResponse(IntentionFocusEntity e) {
        return IntentionFocusResponse.builder()
            .id(e.getId()).focusDate(e.getFocusDate()).text(e.getText()).build();
    }
}
