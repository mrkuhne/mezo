package io.mrkuhne.mezo.feature.habit.mapper;

import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import java.time.ZoneOffset;
import org.springframework.stereotype.Component;

/**
 * Composes the API {@link HabitResponse} from the static catalog definition + the (optional) day
 * row: content (chain/title/why/mode/xp) is catalog-deterministic, state (status/doneAt/id) comes
 * from the row when present, defaulting to a pending, row-less habit. Not a MapStruct entity map —
 * the response is a two-source join, and the DTO's chain/mode/status are generated enums.
 */
@Component
public class HabitMapper {

    public HabitResponse toResponse(HabitCatalog.HabitDef def, HabitDayEntity row,
        Integer strengthPct) {
        String status = row != null ? row.getStatus() : HabitDayEntity.STATUS_PENDING;
        return HabitResponse.builder()
            .id(row != null ? row.getId() : null)
            .key(def.key())
            .chain(HabitResponse.ChainEnum.fromValue(def.chain()))
            .position(def.position())
            .title(def.title())
            .why(def.why())
            .anchorCopy(def.anchorCopy())
            .mode(HabitResponse.ModeEnum.fromValue(def.mode()))
            .status(HabitResponse.StatusEnum.fromValue(status))
            .doneAt(row != null && row.getDoneAt() != null
                ? row.getDoneAt().atOffset(ZoneOffset.UTC) : null)
            .xp(def.xp())
            .strengthPct(strengthPct)
            .build();
    }
}
