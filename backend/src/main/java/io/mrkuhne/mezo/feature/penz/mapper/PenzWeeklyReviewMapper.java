package io.mrkuhne.mezo.feature.penz.mapper;

import io.mrkuhne.mezo.api.dto.PenzWeeklyReviewResponse;
import io.mrkuhne.mezo.api.dto.PenzWeeklySection;
import io.mrkuhne.mezo.api.dto.PenzWeeklySource;
import io.mrkuhne.mezo.api.dto.PenzWeeklyStory;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklyReviewEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklySectionJson;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** The stored weekly review ↔ the {@code PenzWeekly} API shapes (mezo-r36n9.120); enums from their wire value. */
@Mapper(componentModel = "spring")
public interface PenzWeeklyReviewMapper {

    @Mapping(target = "sleeve", expression = "java(PenzWeeklySection.SleeveEnum.fromValue(s.sleeve()))")
    @Mapping(target = "narratedBy", expression = "java(PenzWeeklySection.NarratedByEnum.fromValue(s.narratedBy()))")
    PenzWeeklySection section(PenzWeeklySectionJson s);

    @Mapping(target = "kind", expression = "java(PenzWeeklyStory.KindEnum.fromValue(s.kind()))")
    PenzWeeklyStory story(PenzWeeklySectionJson.Story s);

    PenzWeeklySource source(PenzWeeklySectionJson.Source s);

    /** A stored row: its week, status, stamp and sections. */
    default PenzWeeklyReviewResponse review(PenzWeeklyReviewEntity e) {
        List<PenzWeeklySection> sections = new ArrayList<>();
        e.getSections().forEach(s -> sections.add(section(s)));
        return new PenzWeeklyReviewResponse()
            .weekStart(e.getWeekStart())
            .weekEnd(e.getWeekStart().plusDays(6))
            .status(PenzWeeklyReviewResponse.StatusEnum.fromValue(e.getStatus()))
            .generatedAt(map(e.getGeneratedAt()))
            .sections(sections);
    }

    /** No row for the week yet. */
    default PenzWeeklyReviewResponse pending(LocalDate weekStart) {
        return new PenzWeeklyReviewResponse().weekStart(weekStart).weekEnd(weekStart.plusDays(6))
            .status(PenzWeeklyReviewResponse.StatusEnum.PENDING).sections(new ArrayList<>());
    }

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
