package io.mrkuhne.mezo.feature.progression.mapper;

import io.mrkuhne.mezo.api.dto.LevelUpGain;
import io.mrkuhne.mezo.api.dto.LevelUpPerk;
import io.mrkuhne.mezo.api.dto.LevelUpRobustness;
import org.springframework.stereotype.Component;

/** Maps the internal progression LevelUpResult (jsonb record) to the generated API DTO. */
@Component
public class LevelUpResultMapper {

    public io.mrkuhne.mezo.api.dto.LevelUpResult toDto(
        io.mrkuhne.mezo.feature.progression.entity.LevelUpResult r) {
        if (r == null) {
            return null;
        }
        return io.mrkuhne.mezo.api.dto.LevelUpResult.builder()
            .source(io.mrkuhne.mezo.api.dto.LevelUpResult.SourceEnum.fromValue(r.source()))
            .workoutLabel(r.workoutLabel())
            .durationMin(r.durationMin())
            .rpe(r.rpe())
            .totalXp(r.totalXp())
            .gains(r.gains().stream().map(g -> LevelUpGain.builder()
                .skillKey(g.skillKey())
                .kind(LevelUpGain.KindEnum.fromValue(g.kind()))
                .name(g.name())
                .icon(g.icon())
                .xpGained(g.xpGained())
                .levelBefore(g.levelBefore())
                .levelAfter(g.levelAfter())
                .progressFromPct(java.math.BigDecimal.valueOf(g.progressFromPct()))
                .progressToPct(java.math.BigDecimal.valueOf(g.progressToPct()))
                .build()).toList())
            .levelUps(r.levelUps())
            .perks(r.perks().stream().map(p -> LevelUpPerk.builder()
                .skillKey(p.skillKey())
                .perkKey(p.perkKey())
                .name(p.name())
                .effectCopy(p.effectCopy())
                .milestoneLevel(p.milestoneLevel())
                .build()).toList())
            .robustness(LevelUpRobustness.builder()
                .xpGained(r.robustness().xpGained())
                .streakWeeks(r.robustness().streakWeeks())
                .build())
            .build();
    }
}
