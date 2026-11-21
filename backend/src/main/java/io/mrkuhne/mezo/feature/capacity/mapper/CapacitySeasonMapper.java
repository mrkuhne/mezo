package io.mrkuhne.mezo.feature.capacity.mapper;

import io.mrkuhne.mezo.api.dto.CapacitySeasonLoad;
import io.mrkuhne.mezo.api.dto.CapacitySeasonStats;
import io.mrkuhne.mezo.api.dto.CapacitySeasonWeek;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadService.SeasonLoad;

/** Domain season load to its API shape. */
public final class CapacitySeasonMapper {

    private CapacitySeasonMapper() {
    }

    public static CapacitySeasonLoad toDto(SeasonLoad l) {
        return CapacitySeasonLoad.builder()
            .weeks(l.weeks().stream().map(w -> CapacitySeasonWeek.builder().week(w.week()).load(w.load())
                .recovery(w.recovery()).planned(w.planned()).over(w.over()).trainingOnly(w.trainingOnly()).build())
                .toList())
            .nowWeek(l.nowWeek())
            .stats(CapacitySeasonStats.builder().overloadedDays4w(l.overloadedDays4w()).moves(l.moves())
                .movesGood(l.movesGood()).build())
            .headline(l.headline())
            .build();
    }
}
