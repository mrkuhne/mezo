package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * S7 (mezo-d6ivw.7): the csapatfal reads the ONE memory engine — the user's active, prompt-included
 * knowledge facts owned by the speaking character's area (confirmed observations, chat facts,
 * question answers, csapatfal exceptions), plus up to {@value #MEZO_MAX} of Mezo's general ones.
 * Replaces {@code NoopTeamChatKnowledge}. Fail-open: an error is an empty block, never a lost line.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatKnowledgeAdapter implements TeamChatKnowledgePort {

    static final int MAX = 6;
    static final int MEZO_MAX = 2;
    private static final String MEZO_OWNER = "mezo";

    private final KnowledgeFactService facts;

    /**
     * The area's own facts first, then Mezo's general ones — never more than {@value #MAX} total.
     *
     * <p>For a postable area (falat, mocor, szunya, derű): own-area facts fill the block up to
     * {@code MAX} minus however many Mezo facts actually exist to use (at most {@value #MEZO_MAX}),
     * then those Mezo facts are appended — so a user with no general facts yet still gets the full
     * {@value #MAX} area facts, and one with plenty of both gets an area-heavy mix capped at two
     * Mezo lines. For {@link TeamCharacter#MEZO} itself, and for {@link TeamCharacter#SZKEPTIKUS}
     * (whose {@link TeamCharacter#key()} matches no owner), the block is Mezo facts only, up to
     * {@value #MAX}.
     */
    @Override
    public List<String> forArea(UUID owner, TeamCharacter area) {
        try {
            String key = area.key();
            boolean isMezo = MEZO_OWNER.equals(key);
            List<String> mezo = facts.promptFactsForOwners(owner, List.of(MEZO_OWNER), isMezo ? MAX : MEZO_MAX);
            if (isMezo) {
                return mezo;
            }
            List<String> own = facts.promptFactsForOwners(owner, List.of(key), MAX - Math.min(MEZO_MAX, mezo.size()));
            return Stream.concat(own.stream(), mezo.stream()).limit(MAX).toList();
        } catch (RuntimeException e) {
            log.warn("Team chat knowledge block failed for user {} area {} — empty", owner, area, e);
            return List.of();
        }
    }
}
