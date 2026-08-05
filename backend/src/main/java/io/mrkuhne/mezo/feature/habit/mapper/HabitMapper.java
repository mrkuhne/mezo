package io.mrkuhne.mezo.feature.habit.mapper;

import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import java.time.ZoneOffset;
import org.springframework.stereotype.Component;

/**
 * Composes the API {@link HabitResponse} from the DB-backed catalog definition + the (optional)
 * day row: content (chain/title/why/mode/xp) is catalog-deterministic, state (status/doneAt/id)
 * comes from the row when present, defaulting to a pending, row-less habit. Not a MapStruct entity
 * map — the response is a two-source (three-source, incl. the chain key) join, and the DTO's
 * chain/mode/status are generated enums.
 */
@Component
public class HabitMapper {

    public HabitResponse toResponse(HabitDefEntity def, String chainKey, HabitDayEntity row,
        Integer strengthPct) {
        String status = row != null ? row.getStatus() : HabitDayEntity.STATUS_PENDING;
        return HabitResponse.builder()
            .id(row != null ? row.getId() : null)
            .key(def.getHabitKey())
            .chain(HabitResponse.ChainEnum.fromValue(chainKey))
            .position(def.getPosition())
            .title(def.getTitle())
            .why(def.getWhy())
            .anchorCopy(def.getAnchorCopy())
            .mode(HabitResponse.ModeEnum.fromValue(def.getMode()))
            .status(HabitResponse.StatusEnum.fromValue(status))
            .doneAt(row != null && row.getDoneAt() != null
                ? row.getDoneAt().atOffset(ZoneOffset.UTC) : null)
            .xp(def.getXp())
            .strengthPct(strengthPct)
            .linkUrl(def.getLinkUrl())
            .build();
    }
}
