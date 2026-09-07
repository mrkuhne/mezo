package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S3 (bd mezo-eq85.3, spec 2026-09-06 §5): the {@code [Észrevételek]} chat block — what
 * Mezo is CURRENTLY watching. A companion that quietly runs a nightly experiment on you and cannot
 * mention it when you ask is not a companion; this is the seam that lets the chat turn speak about
 * an open hypothesis in the same breath as everything else it knows.
 *
 * <p>Strictly READ-ONLY over the lifecycle: it renders {@code status}, the tallies and {@code
 * belief} exactly as the engine computed them. Nothing the model says about this block can move a
 * row — the reply path (a {@code user_reply} event) is the only channel that feeds back.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ReflectionPromptBlock {

    /** Enough for the model to know what is in flight; more would crowd the turn's real context. */
    private static final int MAX_ROWS = 5;

    private static final Set<String> OPEN_STATUSES =
            Set.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING);
    private static final Set<String> RENDERED_KINDS =
            Set.of(PatternEntity.KIND_REFLECTION, PatternEntity.KIND_AI_HYPOTHESIS);

    private final PatternRepository patternRepository;

    /** The block, or {@code ""} when nothing is open — an empty header would be noise, not honesty. */
    @Transactional(readOnly = true)
    public String render(UUID userId) {
        List<PatternEntity> rows = patternRepository
                .findByCreatedByAndStatusInAndDeletedFalse(userId, OPEN_STATUSES).stream()
                .filter(row -> RENDERED_KINDS.contains(row.getKind()))
                .sorted(Comparator.comparing(PatternEntity::getLastDetectedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_ROWS)
                .toList();
        if (rows.isEmpty()) {
            return "";
        }
        return "\n\n[Észrevételek — amit Mezo most figyel]\n"
                + rows.stream().map(ReflectionPromptBlock::line).collect(Collectors.joining("\n"));
    }

    private static String line(PatternEntity row) {
        return "- " + row.getTitle() + " (" + statusLabel(row.getStatus())
                + " · " + row.getEvidenceHits() + " bejött / " + row.getEvidenceMisses() + " nem"
                + belief(row.getBelief()) + ")";
    }

    private static String statusLabel(String status) {
        return PatternEntity.STATUS_MONITORING.equals(status) ? "figyeljük" : "friss sejtés";
    }

    /** Omitted rather than guessed at: a row the engine has not scored yet has no certainty. */
    private static String belief(BigDecimal belief) {
        return belief == null ? ""
                : " · bizonyosság " + belief.multiply(BigDecimal.valueOf(100))
                        .setScale(0, RoundingMode.HALF_UP).toPlainString() + "%";
    }
}
