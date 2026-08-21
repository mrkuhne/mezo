package io.mrkuhne.mezo.feature.journal.mapper;

import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

/** Entity → wire. {@code contextSnapshot} is deliberately NOT mapped: the snapshot never leaves
 *  the server this slice (spec §5.4 — it exists for W3 recall, not for display). */
@Mapper(componentModel = "spring")
public interface DecisionMapper {

    DecisionEntryResponse toResponse(DecisionEntryEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
