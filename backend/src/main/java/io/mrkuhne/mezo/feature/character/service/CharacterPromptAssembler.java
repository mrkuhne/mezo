package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Renders the [Karakter] dossier block for the companion system prompt (Karakter spec §8,
 * mezo-1gim.8): CORE dimensions in catalog order, then the META self-audit dimension, then
 * CHAPTER dimensions by createdAt, each as an optional one-line portrait digest (first sentence, flattened and
 * capped 160 chars, only once the dimension's maturity clears {@code portraitMinMaturity} — the
 * full prose stays a UI concern) followed by its qualifying ACTIVE claims, each flattened to one
 * line and capped so model-authored text can never forge an extra bullet or a fake dimension
 * header inside the block, human confidence words only (never the raw decimal — the
 * Minták/PortraitWriter precedent), ranked by {@code confidence × exp(-ageDays/τ)} so a fresher
 * weaker claim can still lead (mirrors {@code MemoryRecallService}'s similarity × recency decay).
 * A dimension with neither a qualifying digest nor a qualifying claim is omitted entirely; the
 * whole block is capped at {@code maxTotalChars} by dropping any dimension block that would blow
 * the budget WHOLE (never mid-line) — an oversized dimension is skipped, not fatal to the ones
 * after it, so the result never needs a truncation marker and never loses the whole dossier over
 * one crowded dimension.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class CharacterPromptAssembler implements CharacterPromptSource {

    /** Same "\n\n[Blokk] (magyarázat):\n" shape as the facts/[Emlékek]/[Összefüggések] headers —
     *  the parenthetical also supplies the facts-vs-claims + ÉRZÉKENY tone rule (spec §3, §8)
     *  that would otherwise never reach the chat prompt itself. */
    private static final String HEADER = "\n\n[Karakter — amit eddig megtudtam {{NÉV}} személyéről] (értelmezések,"
            + " nem tények; az ÉRZÉKENY jelöléssel ellátott állításokat tükörként vagy kérdésként"
            + " hozd fel, sosem ítélkezve; az önvizsgálat sorai a saját találati arányomról szólnak —"
            + " ezekhez tartsd magad, ne ígérj magabiztosabban, mint amit igazolnak):\n";
    private static final String CORE_KIND = "CORE";
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final int PORTRAIT_DIGEST_MAX_CHARS = 160;
    /** Per-claim flatten cap — generous for a one-sentence observation, small enough that one
     *  runaway claim can't eat the dimension's whole share of {@code maxTotalChars}. */
    private static final int CLAIM_TEXT_MAX_CHARS = 300;

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
    private final PromptPersona promptPersona;

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

        String header = promptPersona.render(userId, HEADER);
        StringBuilder result = new StringBuilder(header);
        for (String block : blocks) {
            if (result.length() + block.length() > config.maxTotalChars()) {
                // One oversized dimension must never suppress the ones after it — skip just this
                // block WHOLE (never mid-line) and keep scanning (I3, mezo-1gim.8 final review).
                continue;
            }
            result.append(block);
        }
        return result.length() == header.length() ? "" : result.toString();
    }

    private List<CharacterDimensionEntity> orderedDimensions(UUID userId) {
        return dimensionRepository.findByCreatedBy(userId).stream()
                .sorted(Comparator
                        .comparing((CharacterDimensionEntity d) -> kindRank(d.getKind()))
                        .thenComparing(d -> CORE_KIND.equals(d.getKind())
                                ? CORE_ORDER.getOrDefault(d.getKey(), Integer.MAX_VALUE) : 0)
                        .thenComparing(CharacterDimensionEntity::getCreatedAt))
                .toList();
    }

    /** CORE (catalog order) → META (the self-audit) → CHAPTER (createdAt), round-4 spec §4.2. */
    private static int kindRank(String kind) {
        if (CORE_KIND.equals(kind)) {
            return 0;
        }
        return CharacterCoreCatalog.KIND_META.equals(kind) ? 1 : 2;
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
            block.append(") ").append(oneLine(claim.getText(), CLAIM_TEXT_MAX_CHARS)).append('\n');
        }
        return block.toString();
    }

    private static String dimensionHeaderLine(CharacterDimensionEntity dimension, String digest) {
        String label = dimension.getExpertKey() == null ? dimension.getTitle() : expertLabel(dimension);
        return digest == null ? label + ":" : label + ": " + digest;
    }

    /** {@code "<title> (<expert display name>)"} — falls back to the bare title on a stale/unknown
     *  {@code expertKey} instead of throwing, so a dossier data problem can never 500 a chat turn
     *  (I5, mezo-1gim.8 final review): {@link CharacterExpertCatalog#byKey} throws on a miss. */
    private static String expertLabel(CharacterDimensionEntity dimension) {
        try {
            return dimension.getTitle() + " (" + CharacterExpertCatalog.byKey(dimension.getExpertKey()).displayName() + ")";
        } catch (RuntimeException e) {
            log.warn("Unknown character expert key '{}' on dimension '{}' — omitting the expert label",
                    dimension.getExpertKey(), dimension.getKey(), e);
            return dimension.getTitle();
        }
    }

    /** Flattens model-authored text to one line (all whitespace runs, including embedded
     *  newlines, collapsed to a single space) and caps it — the same treatment
     *  {@code PromptMemoryAssembler.oneLine} gives recalled memory content — so a claim or
     *  portrait sentence can never forge an extra bullet or a fake dimension header inside the
     *  block (I2, mezo-1gim.8 final review). */
    private static String oneLine(String text, int maxChars) {
        if (text == null) {
            return "";
        }
        String flat = text.strip().replaceAll("\\s+", " ");
        return flat.length() > maxChars ? flat.substring(0, maxChars) + "…" : flat;
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

    /** The portrait's first sentence (split on {@code ". "} after flattening all whitespace,
     *  including embedded newlines, to single spaces — so a sentence ending {@code ".\n"} still
     *  splits correctly instead of dragging the next paragraph into the digest), capped at 160
     *  chars — never the whole prose, which stays the UI's job — or {@code null} below
     *  {@code minMaturity} or with no portrait yet. */
    private static String portraitDigest(CharacterDimensionEntity dimension, int minMaturity) {
        Short maturity = dimension.getMaturity();
        if (maturity == null || maturity < minMaturity) {
            return null;
        }
        String portrait = dimension.getPortrait();
        if (portrait == null || portrait.isBlank()) {
            return null;
        }
        String flat = portrait.strip().replaceAll("\\s+", " ");
        int splitAt = flat.indexOf(". ");
        String firstSentence = splitAt >= 0 ? flat.substring(0, splitAt + 1) : flat;
        return oneLine(firstSentence, PORTRAIT_DIGEST_MAX_CHARS);
    }
}
