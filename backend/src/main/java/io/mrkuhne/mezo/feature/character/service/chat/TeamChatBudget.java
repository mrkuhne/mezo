package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The team chat monthly USD cap (Csapatfal Act III Task 7, mezo-a9bo7.22, spec 2026-09-26 §5) —
 * the guard the E2 voice seam checks before spending an LLM call on a {@code team_chat} line: at
 * or over {@code mezo.character.team-chat.monthly-usd-cap} the caller falls back to the honest
 * template text instead ({@code voiced=false}), same as any other guard failure.
 *
 * <p>Scoped to the {@code team_chat} feature slug alone (see
 * {@link LlmLogRepository#costForOwnerFeatureSince}) — a different feature's spend never eats into
 * this budget, and this budget never throttles another feature. This is deliberately a SEPARATE
 * primitive from {@link io.mrkuhne.mezo.feature.llmlog.service.LlmBudgetService}'s account-wide
 * rolling ceiling: that one grades the whole account across every feature, this one is a hard
 * per-feature yes/no the voice seam reads directly.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatBudget {

    static final String FEATURE = "team_chat";
    private static final Duration WINDOW = Duration.ofDays(30);

    private final LlmLogRepository llmLogRepository;
    private final TeamChatProperties properties;

    /** {@code owner}'s {@code team_chat} spend over the last 30 days is under the monthly cap. */
    public boolean hasRoom(UUID owner) {
        Instant since = Instant.now().minus(WINDOW);
        BigDecimal spent = llmLogRepository.costForOwnerFeatureSince(owner, FEATURE, since);
        return spent.compareTo(properties.monthlyUsdCap()) < 0;
    }
}
