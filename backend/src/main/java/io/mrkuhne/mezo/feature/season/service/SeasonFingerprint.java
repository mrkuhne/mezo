package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

/**
 * The state a season preview was computed against (spec §5.3, Review Focus 2) — pure. SHA-256 over the season's
 * status, window and accepted draft, its goal (accepted adjustment and overrides included), the weekly slots, the latest weight trend point and weigh-in, the sleep goal and the
 * running block with its days and exercises (mezo-r36n9.122: a gym-day change re-arranges them in the same accept). Any of them moving between the preview and the accept makes the accept a 409
 * {@code SEASON_PREVIEW_STALE}, so a preview opened before a weigh-in is never applied after it.
 */
public final class SeasonFingerprint {

    private SeasonFingerprint() {
    }

    public static String of(SeasonEntity s, Optional<SeasonGoalPort.GoalView> goal, SeasonTrainPort.Schedule slots,
                            List<SeasonMetricsPort.TrendPoint> trend, String latestWeighIn,
                            SeasonSleepPort.SleepGoal sleep, Optional<SeasonTrainPort.Block> block,
                            String blockState) {
        StringBuilder b = new StringBuilder();
        b.append("season|").append(s.getId()).append('|').append(s.getStatus()).append('|').append(s.getStartDate())
            .append('|').append(s.getWeeks()).append('|').append(s.getSleepNeedMin()).append('|').append(s.getDraft())
            .append('\n');
        goal.ifPresent(g -> b.append("goal|").append(g.id()).append('|').append(g.status()).append('|')
            .append(g.fields()).append('|').append(g.balanceAdjustmentKcal()).append('|').append(g.segmentOverrides())
            .append('\n'));
        b.append("slots|").append(slots.gymDays()).append('|').append(slots.gymTime()).append('|')
            .append(slots.sport()).append('\n');
        SeasonMetricsPort.TrendPoint last = trend.isEmpty() ? null : trend.get(trend.size() - 1);
        b.append("trend|").append(last == null ? "-" : last.date() + "|" + last.kg().stripTrailingZeros().toPlainString())
            .append('|').append(trend.size()).append('|').append(latestWeighIn).append('\n');
        b.append("sleep|").append(sleep).append('\n');
        block.ifPresent(m -> b.append("block|").append(m.id()).append('|').append(m.status()).append('|')
            .append(m.startDate()).append('|').append(m.weeks()).append('\n'));
        b.append("days|").append(blockState).append('\n');
        return sha256(b.toString());
    }

    private static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new AssertionError(e); // SHA-256 is mandatory on every JVM
        }
    }
}
