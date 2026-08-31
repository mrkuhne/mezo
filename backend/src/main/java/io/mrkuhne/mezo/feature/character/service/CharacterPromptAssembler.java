package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Renders the [Karakter] dossier block for the companion system prompt (Karakter spec §8,
 * mezo-1gim.8): CORE dimensions in {@link CharacterCoreCatalog} order, then CHAPTER dimensions by
 * {@code createdAt}, each as an optional one-line portrait digest (first sentence, capped 160
 * chars, only once the dimension's maturity clears {@code portraitMinMaturity} — the full prose
 * stays a UI concern) followed by its qualifying ACTIVE claims, human confidence words only
 * (never the raw decimal — the Minták/PortraitWriter precedent), ranked by
 * {@code confidence × exp(-ageDays/τ)} so a fresher weaker claim can still lead (mirrors
 * {@code MemoryRecallService}'s similarity × recency decay). A dimension with neither a
 * qualifying digest nor a qualifying claim is omitted entirely; the whole block is capped at
 * {@code maxTotalChars} by dropping trailing dimension blocks WHOLE (never mid-line) so the
 * result never needs a truncation marker.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class CharacterPromptAssembler implements CharacterPromptSource {

    private static final String HEADER = "[Karakter — amit eddig megtudtam Danielről]\n";
    private static final String CORE_KIND = "CORE";
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final int PORTRAIT_DIGEST_MAX_CHARS = 160;

    /** Recency half-life for the confidence x recency ranking (mirrors
     *  {@code CompanionProperties.Recall#decayDays}'s shape) — not spec-tunable, so a plain
     *  constant rather than another *Properties knob. */
    private static final int RECENCY_DECAY_DAYS = 60;

    private static final Map<String, Integer> CORE_ORDER = IntStream.range(0, CharacterCoreCatalog.CORE.size())
            .boxed()
            .collect(Collectors.toMap(i -> CharacterCoreCatalog.CORE.get(i).key(), i -> i));

    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;
    private final CharacterProperties properties;

    @Override
    public String render(UUID userId) {
        List<CharacterDimensionEntity> dimensions = orderedDimensions(userId);
        if (dimensions.isEmpty()) {
            return "";
        }
        CharacterProperties.Prompt config = properties.prompt();
        Instant now = Instant.now();
        List<String> blocks = new ArrayList<>();
        for (CharacterDimensionEntity dimension : dimensions) {
            String block = renderDimensionBlock(userId, dimension, config, now);
            if (block != null) {
                blocks.add(block);
            }
        }

        StringBuilder result = new StringBuilder(HEADER);
        for (String block : blocks) {
            if (result.length() + block.length() > config.maxTotalChars()) {
                break;
            }
            result.append(block);
        }
        return result.length() == HEADER.length() ? "" : result.toString();
    }

    private List<CharacterDimensionEntity> orderedDimensions(UUID userId) {
        return dimensionRepository.findByCreatedBy(userId).stream()
                .sorted(Comparator
                        .comparing((CharacterDimensionEntity d) -> CORE_KIND.equals(d.getKind()) ? 0 : 1)
                        .thenComparing(d -> CORE_KIND.equals(d.getKind())
                                ? CORE_ORDER.getOrDefault(d.getKey(), Integer.MAX_VALUE) : 0)
                        .thenComparing(CharacterDimensionEntity::getCreatedAt))
                .toList();
    }

    /** Null when this dimension has nothing worth rendering (no digest AND no qualifying claim). */
    private String renderDimensionBlock(UUID userId, CharacterDimensionEntity dimension,
                                         CharacterProperties.Prompt config, Instant now) {
        String digest = portraitDigest(dimension, config.portraitMinMaturity());
        List<CharacterClaimEntity> claims = qualifyingClaims(userId, dimension, config, now);
        if (digest == null && claims.isEmpty()) {
            return null;
        }
        StringBuilder block = new StringBuilder(dimensionHeaderLine(dimension, digest)).append('\n');
        for (CharacterClaimEntity claim : claims) {
            block.append("- (").append(CharacterConfidenceWords.word(claim.getConfidence()));
            if (Boolean.TRUE.equals(claim.getSensitive())) {
                block.append(", ÉRZÉKENY");
            }
            block.append(") ").append(claim.getText()).append('\n');
        }
        return block.toString();
    }

    private static String dimensionHeaderLine(CharacterDimensionEntity dimension, String digest) {
        String label = dimension.getExpertKey() == null
                ? dimension.getTitle()
                : dimension.getTitle() + " (" + CharacterExpertCatalog.byKey(dimension.getExpertKey()).displayName() + ")";
        return digest == null ? label + ":" : label + ": " + digest;
    }

    private List<CharacterClaimEntity> qualifyingClaims(UUID userId, CharacterDimensionEntity dimension,
                                                          CharacterProperties.Prompt config, Instant now) {
        return claimRepository
                .findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(userId, dimension.getId(), ACTIVE_STATUS)
                .stream()
                .filter(claim -> claim.getConfidence().compareTo(config.minConfidence()) >= 0)
                .sorted(Comparator.comparingDouble((CharacterClaimEntity claim) -> recencyScore(claim, now)).reversed())
                .limit(config.maxClaimsPerDimension())
                .toList();
    }

    /** {@code confidence × exp(-ageDays/τ)} — a fresher, less-confident claim can still lead. */
    private static double recencyScore(CharacterClaimEntity claim, Instant now) {
        double confidence = claim.getConfidence().doubleValue();
        long ageDays = Math.max(0, Duration.between(claim.getUpdatedAt(), now).toDays());
        return confidence * Math.exp(-(double) ageDays / RECENCY_DECAY_DAYS);
    }

    /** The portrait's first sentence (split on {@code ". "}), capped at 160 chars — never the
     *  whole prose, which stays the UI's job — or {@code null} below {@code minMaturity} or with
     *  no portrait yet. */
    private static String portraitDigest(CharacterDimensionEntity dimension, int minMaturity) {
        Short maturity = dimension.getMaturity();
        if (maturity == null || maturity < minMaturity) {
            return null;
        }
        String portrait = dimension.getPortrait();
        if (portrait == null || portrait.isBlank()) {
            return null;
        }
        int splitAt = portrait.indexOf(". ");
        String firstSentence = splitAt >= 0 ? portrait.substring(0, splitAt + 1) : portrait.strip();
        return firstSentence.length() > PORTRAIT_DIGEST_MAX_CHARS
                ? firstSentence.substring(0, PORTRAIT_DIGEST_MAX_CHARS) : firstSentence;
    }
}
