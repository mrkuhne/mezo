package io.mrkuhne.mezo.feature.people.mapper;

import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface PeopleMapper {

    /**
     * Mention-derived stats are computed in the service from live mention rows —
     * never persisted, never seeded (the honest-numbers rule).
     */
    @Mapping(target = "mentionCount", source = "mentionCount")
    @Mapping(target = "mentionsThisWeek", source = "mentionsThisWeek")
    @Mapping(target = "lastMentionedAt", source = "lastMentionedAt")
    PersonResponse toPersonResponse(PersonEntity entity, int mentionCount, int mentionsThisWeek,
        Instant lastMentionedAt);

    /** {@code personName} is joined in the service (mention rows only carry the FK). */
    @Mapping(target = "personName", source = "personName")
    MentionResponse toMentionResponse(MentionEntity entity, String personName);

    /** Entity stores Instant; the generated contract type uses OffsetDateTime (UTC on the wire either way). */
    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    // Entity columns are plain Strings gated by DB CHECKs; the generated enums carry lowercase
    // wire values under uppercase constant names, so MapStruct's default valueOf() lookup fails —
    // map via fromValue().
    default PersonResponse.RelationshipEnum mapRelationship(String value) {
        return value == null ? null : PersonResponse.RelationshipEnum.fromValue(value);
    }

    default PersonResponse.AffectBaselineEnum mapAffectBaseline(String value) {
        return value == null ? null : PersonResponse.AffectBaselineEnum.fromValue(value);
    }

    default MentionResponse.SourceEnum mapSource(String value) {
        return value == null ? null : MentionResponse.SourceEnum.fromValue(value);
    }

    default MentionResponse.ToneEnum mapTone(String value) {
        return value == null ? null : MentionResponse.ToneEnum.fromValue(value);
    }
}
