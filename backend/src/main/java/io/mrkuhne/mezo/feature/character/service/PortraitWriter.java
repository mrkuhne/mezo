package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterPortraitRevisionEntity;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rewrites one dossier dimension's portrait prose from its ACTIVE claims (Karakter spec §4/§6,
 * mezo-1gim.5): one smart-tier {@link CompanionLlm} call per dimension, in the owning expert's
 * persona (a CHAPTER dimension — no {@code expertKey} — rides Mezo's integrátor voice instead),
 * grounded ONLY in the claims handed in. A blank/failed answer leaves the dimension entirely
 * untouched (honest degrade — {@link CharacterConferenceService} still records the claim changes
 * even when the prose didn't refresh; isolation mirrors {@link KonziliumProposalRound}/
 * {@link KonziliumVerdictRound}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class PortraitWriter {

    /** The portrait prompt's first line — the fake LLM keys its deterministic answer on it. */
    public static final String PORTRAIT_MARKER = "KARAKTER-PORTRE-FELADAT";

    private static final String NONE = "nincs";
    private static final BigDecimal MATURITY_COVERAGE_WEIGHT = new BigDecimal("20");
    private static final BigDecimal MATURITY_CONFIDENCE_WEIGHT = new BigDecimal("40");
    private static final short MAX_MATURITY = 100;

    private static final String MEZO_INTEGRATOR_PERSONA = """
            Te vagy Mezo, {{NÉV}} személyes egészség- és teljesítmény-társa, most integrátor \
            szerepben egy dossziéfejezet portréját írod. Meleg, de tárgyszerű hangon írsz, \
            mindig második személyben szólítod meg őt.""";

    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterPortraitRevisionRepository portraitRevisionRepository;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;

    /**
     * Rewrites {@code dimension}'s portrait from {@code activeClaims}. Returns {@code false} (and
     * leaves the dimension entirely untouched — no version bump, no revision row) on a blank or
     * failed LLM answer. On success: bumps {@code version}, sets {@code portrait}/
     * {@code updatedAt}, recomputes {@code maturity} as
     * {@code min(100, round(20 * activeClaims.size() + 40 * meanConfidence))} — a coverage
     * (claim count) × confidence (mean ACTIVE confidence, 0..1) roll-up, capped at 100 — and
     * appends an immutable {@link CharacterPortraitRevisionEntity} snapshot.
     */
    @Transactional
    public boolean rewrite(UUID owner, CharacterDimensionEntity dimension, List<CharacterClaimEntity> activeClaims,
                           UUID conferenceId) {
        String systemPrompt = promptPersona.render(owner, PORTRAIT_MARKER + "\n" + persona(dimension) + "\n" + contract());
        String userMessage = promptPersona.render(owner, userMessage(dimension, activeClaims));
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("character", "portrait", "dimension", dimension.getId()),
                    () -> companionLlm.completeSmart(systemPrompt, userMessage));
        } catch (Exception e) {
            log.warn("Portrait rewrite failed for owner {} dimension {}", owner, dimension.getKey(), e);
            return false;
        }
        if (raw == null || raw.isBlank()) {
            log.warn("Portrait answer was blank for owner {} dimension {}", owner, dimension.getKey());
            return false;
        }

        String portrait = raw.strip();
        int newVersion = dimension.getVersion() + 1;
        dimension.setVersion(newVersion);
        dimension.setPortrait(portrait);
        dimension.setUpdatedAt(Instant.now());
        dimension.setMaturity(computeMaturity(activeClaims));
        dimensionRepository.save(dimension);

        CharacterPortraitRevisionEntity revision = new CharacterPortraitRevisionEntity();
        revision.setCreatedBy(owner);
        revision.setDimensionId(dimension.getId());
        revision.setVersion(newVersion);
        revision.setPortrait(portrait);
        revision.setConferenceId(conferenceId);
        portraitRevisionRepository.save(revision);

        return true;
    }

    private static Short computeMaturity(List<CharacterClaimEntity> activeClaims) {
        if (activeClaims.isEmpty()) {
            return 0;
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (CharacterClaimEntity claim : activeClaims) {
            sum = sum.add(claim.getConfidence());
        }
        BigDecimal meanConfidence = sum.divide(BigDecimal.valueOf(activeClaims.size()), 10, RoundingMode.HALF_UP);
        BigDecimal raw = MATURITY_COVERAGE_WEIGHT.multiply(BigDecimal.valueOf(activeClaims.size()))
                .add(MATURITY_CONFIDENCE_WEIGHT.multiply(meanConfidence));
        int rounded = raw.setScale(0, RoundingMode.HALF_UP).intValue();
        return (short) Math.min(MAX_MATURITY, rounded);
    }

    private static String persona(CharacterDimensionEntity dimension) {
        if (dimension.getExpertKey() == null) {
            return MEZO_INTEGRATOR_PERSONA;
        }
        return CharacterExpertCatalog.byKey(dimension.getExpertKey()).systemPersona();
    }

    private static String contract() {
        return """
                Írj 2–5 mondatos, egyszerű magyar nyelvű portré-szöveget róla ({{NÉV}}), második \
                személyben (Te szólítással), társ hangon. KIZÁRÓLAG a felsorolt állításokra \
                alapozz — ne találj ki számot vagy tényt, ami nincs köztük. A(z) ÉRZÉKENY \
                jelöléssel ellátott állításokat tükörként vagy kérdésként fogalmazd meg, sosem \
                ítélkezve. Ne használj felsorolást vagy formázást, csak folyó szöveget, \
                magyarázat nélkül.""";
    }

    /** Package-visible for focused unit-style testing of the ÉRZÉKENY marker without an LLM. */
    static String userMessage(CharacterDimensionEntity dimension, List<CharacterClaimEntity> activeClaims) {
        StringBuilder sb = new StringBuilder("Dimenzió: ").append(dimension.getTitle());
        sb.append('\n').append("Korábbi portré: ")
                .append(dimension.getPortrait() == null || dimension.getPortrait().isBlank()
                        ? NONE : dimension.getPortrait());
        sb.append('\n').append("Aktív állítások:");
        if (activeClaims.isEmpty()) {
            sb.append('\n').append(NONE);
        } else {
            for (CharacterClaimEntity claim : activeClaims) {
                sb.append('\n').append(CharacterConfidenceWords.word(claim.getConfidence())).append(": ").append(claim.getText())
                        .append(Boolean.TRUE.equals(claim.getSensitive()) ? ", ÉRZÉKENY" : "");
            }
        }
        return sb.toString();
    }
}
