package io.mrkuhne.mezo.feature.companion.profile.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.config.ProfileProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3): the {@code [Rólad tanultam]} block — the profile node's prose,
 * injected right after the facts blocks so the model reads "how to talk to him" BEFORE the recalled
 * material it will talk about.
 *
 * <p>Archiving the node empties this block until the next weekly run — that is the explicit
 * "reset what you think of me" lever, so this reads the ACTIVE node only.
 *
 * <p>Failure honesty (IDENT-3): never throws — a failure logs a warn and yields "".
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class ProfilePromptAssembler {

    /** Same "\n\n[Blokk] (magyarázat):\n" shape as the facts/[Emlékek]/[Összefüggések] headers. */
    public static final String PROFILE_HEADER = "\n\n[Rólad tanultam] (a visszajelzéseidből és a"
            + " döntéseidből tanult minta — hogyan érdemes veled beszélni; nyersanyag, nem"
            + " felolvasandó lista):\n";

    private final GraphNodeRepository nodeRepository;
    private final ProfileProperties properties;

    /** The block for one turn — "" when there is no active profile. Never throws. */
    @Transactional(readOnly = true)
    public String render(UUID userId) {
        try {
            Optional<GraphNodeEntity> node = nodeRepository
                    .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                            userId, ProfileAssembler.SOURCE_PROFILE, userId)
                    .filter(n -> GraphNodeEntity.STATUS_ACTIVE.equals(n.getStatus()))
                    .filter(n -> n.getSummary() != null && !n.getSummary().isBlank());
            return node.map(n -> renderBlock(n.getSummary().strip())).orElse("");
        } catch (RuntimeException e) {
            log.warn("Profile block skipped for user {} — the turn continues without it", userId, e);
            return "";
        }
    }

    /**
     * Header + prose, with the WHOLE block (header included) kept under {@code renderMaxTokens} —
     * the same house accounting as the sibling blocks: {@code GraphPromptAssembler.renderBlock}
     * seeds its {@code StringBuilder} with the header before measuring, and {@code
     * PromptMemoryAssembler} does the same. The header's own token cost is charged first (ceiling
     * estimate, so it can never be undercounted), and the prose gets whatever budget remains.
     */
    private String renderBlock(String summary) {
        int headerTokens = (PROFILE_HEADER.length() + ProfileAssembler.CHARS_PER_TOKEN - 1)
                / ProfileAssembler.CHARS_PER_TOKEN;
        int proseMaxTokens = Math.max(0, properties.renderMaxTokens() - headerTokens);
        return PROFILE_HEADER + ProfileAssembler.cap(summary, proseMaxTokens);
    }
}
