package io.mrkuhne.mezo.feature.biometrics.checkin.mapper;

import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CravingKind;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CheckInMapper {

    CheckInResponse toResponse(CheckInEntity entity);

    /** Entity stores Instant; the generated contract type uses OffsetDateTime (UTC on the wire either way). */
    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    // ── Check-in 2.0 (mezo-ck2) bridges: NULL in, NULL out (never an empty default) ──────────

    /** Stored item ids ("energy") → contract enum. */
    default List<CheckInItemId> toItemIdEnums(List<String> ids) {
        return ids == null ? null : ids.stream().map(CheckInItemId::fromValue).toList();
    }

    /** Contract enum → stored item ids ("energy"). */
    default List<String> toItemIds(List<CheckInItemId> ids) {
        return ids == null ? null : ids.stream().map(CheckInItemId::getValue).toList();
    }

    default CheckInItemId toItemIdEnum(String id) {
        return id == null ? null : CheckInItemId.fromValue(id);
    }

    default AdaptiveReason toAdaptiveReason(String reason) {
        return reason == null ? null : AdaptiveReason.fromValue(reason);
    }

    default List<io.mrkuhne.mezo.api.dto.PainRegion> toPainRegionDtos(List<PainRegion> regions) {
        return regions == null ? null
            : regions.stream().map(r -> io.mrkuhne.mezo.api.dto.PainRegion.valueOf(r.name())).toList();
    }

    default List<PainRegion> toPainRegions(List<io.mrkuhne.mezo.api.dto.PainRegion> regions) {
        return regions == null ? null : regions.stream().map(r -> PainRegion.valueOf(r.name())).toList();
    }

    default List<io.mrkuhne.mezo.api.dto.CravingKind> toCravingKindDtos(List<CravingKind> kinds) {
        return kinds == null ? null
            : kinds.stream().map(k -> io.mrkuhne.mezo.api.dto.CravingKind.valueOf(k.name())).toList();
    }

    default List<CravingKind> toCravingKinds(List<io.mrkuhne.mezo.api.dto.CravingKind> kinds) {
        return kinds == null ? null : kinds.stream().map(k -> CravingKind.valueOf(k.name())).toList();
    }
}
