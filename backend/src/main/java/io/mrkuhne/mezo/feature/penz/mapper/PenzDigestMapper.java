package io.mrkuhne.mezo.feature.penz.mapper;

import io.mrkuhne.mezo.api.dto.PenzDigestItem;
import io.mrkuhne.mezo.api.dto.PenzDigestResponse;
import io.mrkuhne.mezo.api.dto.PenzDigestSource;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** The stored digest ↔ the {@code PenzNews} API shapes (mezo-r36n9.104); enums from their wire value. */
@Mapper(componentModel = "spring")
public interface PenzDigestMapper {

    @Mapping(target = "kind", expression = "java(PenzDigestItem.KindEnum.fromValue(i.kind()))")
    @Mapping(target = "sleeve",
        expression = "java(i.sleeve() == null ? null : PenzDigestItem.SleeveEnum.fromValue(i.sleeve()))")
    @Mapping(target = "narratedBy", expression = "java(PenzDigestItem.NarratedByEnum.fromValue(i.narratedBy()))")
    PenzDigestItem item(PenzDigestItemJson i);

    PenzDigestSource source(PenzDigestItemJson.Source s);

    /** A stored row: its status, stamps and items. */
    default PenzDigestResponse digest(PenzDigestEntity e, boolean newsHealthy) {
        List<PenzDigestItem> items = new ArrayList<>();
        e.getItems().forEach(i -> items.add(item(i)));
        return new PenzDigestResponse()
            .date(e.getDigestDate())
            .status(PenzDigestResponse.StatusEnum.fromValue(e.getStatus()))
            .generatedAt(map(e.getGeneratedAt()))
            .pricesAsOf(e.getPricesAsOf())
            .newsHealthy(newsHealthy)
            .items(items);
    }

    /** No row for the day yet. */
    default PenzDigestResponse pending(LocalDate date, boolean newsHealthy) {
        return new PenzDigestResponse().date(date).status(PenzDigestResponse.StatusEnum.PENDING)
            .newsHealthy(newsHealthy).items(new ArrayList<>());
    }

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
