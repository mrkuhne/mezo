package io.mrkuhne.mezo.feature.habit.mapper;

import io.mrkuhne.mezo.api.dto.HabitCatalogResponse;
import io.mrkuhne.mezo.api.dto.HabitChainAdmin;
import io.mrkuhne.mezo.api.dto.HabitDefAdmin;
import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Composes the API {@link HabitResponse} from the DB-backed catalog definition + the (optional)
 * day row: content (chain/title/why/mode/xp) is catalog-deterministic, state (status/doneAt/id)
 * comes from the row when present, defaulting to a pending, row-less habit. Not a MapStruct entity
 * map — the response is a two-source (three-source, incl. the chain key) join, and (since
 * mezo-n5e9.1's chain-widening) the DTO's chain is a plain string; mode/status stay generated
 * enums. Also composes the admin/editor DTOs ({@link HabitChainAdmin}/{@link HabitDefAdmin}) used
 * by {@code HabitAdminService}.
 */
@Component
public class HabitMapper {

    public HabitResponse toResponse(HabitDefEntity def, String chainKey, HabitDayEntity row,
        Integer strengthPct, String hint) {
        String status = row != null ? row.getStatus() : HabitDayEntity.STATUS_PENDING;
        return HabitResponse.builder()
            .id(row != null ? row.getId() : null)
            .key(def.getHabitKey())
            .chain(chainKey)
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
            .hint(hint)
            .build();
    }

    public HabitChainAdmin toChainAdmin(HabitChainEntity chain, List<HabitDefAdmin> defs) {
        return HabitChainAdmin.builder()
            .id(chain.getId())
            .chainKey(chain.getChainKey())
            .title(chain.getTitle())
            .daypart(HabitChainAdmin.DaypartEnum.fromValue(chain.getDaypart()))
            .position(chain.getPosition())
            .isActive(chain.getActive())
            .defs(defs)
            .build();
    }

    public HabitDefAdmin toDefAdmin(HabitDefEntity def, String chainKey) {
        return HabitDefAdmin.builder()
            .id(def.getId())
            .habitKey(def.getHabitKey())
            .chainKey(chainKey)
            .position(def.getPosition())
            .title(def.getTitle())
            .why(def.getWhy())
            .anchorCopy(def.getAnchorCopy())
            .mode(HabitDefAdmin.ModeEnum.fromValue(def.getMode()))
            .metric(def.getMetric())
            .skillKey(def.getSkillKey())
            .xp(def.getXp())
            .linkUrl(def.getLinkUrl())
            .framework(def.getFramework() != null
                ? HabitDefAdmin.FrameworkEnum.fromValue(def.getFramework()) : null)
            .anchorHabitKey(def.getAnchorHabitKey())
            .cue(def.getCue())
            .craving(def.getCraving())
            .reward(def.getReward())
            .celebration(def.getCelebration())
            .identity(def.getIdentity())
            .isActive(def.getActive())
            .build();
    }

    public HabitCatalogResponse toCatalogResponse(List<HabitChainAdmin> chains) {
        return HabitCatalogResponse.builder().chains(chains).build();
    }
}
