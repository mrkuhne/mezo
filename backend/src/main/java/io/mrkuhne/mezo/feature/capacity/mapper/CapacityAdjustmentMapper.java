package io.mrkuhne.mezo.feature.capacity.mapper;

import io.mrkuhne.mezo.api.dto.CapacityAdjustment;
import io.mrkuhne.mezo.feature.capacity.service.DayAdjustmentView;
import java.time.ZoneOffset;

/** A ledger row to its API shape (Boop B7 K3, mezo-r36n9.17). The payload goes out as the stored map. */
public final class CapacityAdjustmentMapper {

    private CapacityAdjustmentMapper() {
    }

    public static CapacityAdjustment toDto(DayAdjustmentView v) {
        return CapacityAdjustment.builder()
            .id(v.id())
            .date(v.date())
            .kind(CapacityAdjustment.KindEnum.fromValue(v.payload().kind().name()))
            .payload(v.payload().toMap())
            .bundleId(v.bundleId())
            .proposalId(v.proposalId())
            .state(CapacityAdjustment.StateEnum.fromValue(v.state().wire()))
            .createdAt(v.createdAt() == null ? null : v.createdAt().atOffset(ZoneOffset.UTC))
            .build();
    }
}
