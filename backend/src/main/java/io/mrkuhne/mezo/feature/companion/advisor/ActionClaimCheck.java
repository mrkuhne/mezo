package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.List;
import java.util.Optional;

/**
 * mezo-q0p5a: the companion has NO write tools (ArchUnit-enforced) — every registered tool is a
 * read — yet in production it answered "Felírtam: taco, fehérjeszelet, banán." and the user
 * believed the food was logged. It was not: silent data loss. Task 1 (mezo-rj214.7) told the live
 * voice not to fabricate action claims; this check is the backstop, because the prompt ALREADY
 * forbade it when that answer shipped — asking nicely has a demonstrated failure rate here.
 *
 * <p>Deterministic (a fixed term list, no LLM), accent-folded like {@link ClinicalOutputCheck}.
 * Precision over recall on purpose: the terms are complete, already-conjugated first-person
 * PAST-tense forms (e.g. "felírtam", not the stem "felír"), so an offer ("felírhatod"), an
 * instruction ("felírni"), a second-person form, or a negation that separates the verb prefix
 * ("nem írtam fel") do not contain the term and do not fire. A bounded list cannot separate every
 * Hungarian inflection from the claim it resembles; when in doubt this check stays silent rather
 * than rewriting an honest answer — see the task-2 report for the cases this trades away.
 */
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
public class ActionClaimCheck {

    static final String CHECK_NAME = "action-claim";

    private final List<String> actionClaimTerms;

    @Autowired
    public ActionClaimCheck(CompanionProperties properties) {
        this(properties.advisors().actionClaimTerms());
    }

    ActionClaimCheck(List<String> actionClaimTerms) {
        this.actionClaimTerms = actionClaimTerms.stream().map(ActionClaimCheck::fold).toList();
    }

    public Optional<AdvisorViolation> check(String answer) {
        if (answer == null || answer.isBlank()) {
            return Optional.empty();
        }
        String folded = fold(answer);
        if (actionClaimTerms.stream().anyMatch(folded::contains)) {
            return Optional.of(new AdvisorViolation(CHECK_NAME,
                    "A válasz múlt idejű, első személyű cselekvés-állítást tartalmaz (pl. "
                            + "\"felírtam\"), de a companion-nak nincs írási eszköze — nem hajtott "
                            + "végre semmilyen módosítást. Fogalmazd át ajánlásként vagy útmutatásként "
                            + "(pl. \"ezt te tudod felírni\"), ne kész tényként."));
        }
        return Optional.empty();
    }

    /** Lowercase + NFD accent-strip — "Felírtam" -> "felirtam", matches without diacritics. */
    private static String fold(String text) {
        return Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
