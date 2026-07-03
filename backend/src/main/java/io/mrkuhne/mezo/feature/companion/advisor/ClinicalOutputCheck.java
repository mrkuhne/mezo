package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * V1.3 clinical output check (old docs §4.11, "lite"): reject an answer that suggests changing a
 * prescription-drug dose — an Rx term AND a dose-change verb in the SAME sentence. Deterministic
 * (regex, no LLM), accent-folded so "reta" matches "Retát". Precision over recall: statements
 * ("4 mg a szokásos adagod") pass; the system-prompt hard rule remains the first defense.
 */
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
public class ClinicalOutputCheck {

    static final String CHECK_NAME = "clinical";

    private static final Pattern SENTENCE_SPLIT = Pattern.compile("[.!?\\n]+");
    /** Written accent-FOLDED (novel/csokkent/modosit…) — it matches the folded answer text. */
    private static final Pattern DOSE_CHANGE_VERB = Pattern.compile(
            "emeld|emeljuk|noveld|noveljuk|csokkentsd|csokkentsuk|duplazd|duplazzuk|felezd|felezzuk"
                    + "|hagyd el|hagyd ki|hagyjuk el|hagyjuk ki|modositsd|modositsuk|allitsd at|allitsuk at");

    private final List<String> rxTerms;

    @Autowired
    public ClinicalOutputCheck(CompanionProperties properties) {
        this(properties.advisors().rxTerms());
    }

    ClinicalOutputCheck(List<String> rxTerms) {
        this.rxTerms = rxTerms.stream().map(ClinicalOutputCheck::fold).toList();
    }

    public Optional<AdvisorViolation> check(String answer) {
        for (String sentence : SENTENCE_SPLIT.split(fold(answer))) {
            if (DOSE_CHANGE_VERB.matcher(sentence).find()
                    && rxTerms.stream().anyMatch(sentence::contains)) {
                return Optional.of(new AdvisorViolation(CHECK_NAME,
                        "Rx gyógyszer adagolásának módosítását javasolja — ez orvosi döntés."));
            }
        }
        return Optional.empty();
    }

    /** Lowercase + NFD accent-strip — "Retát" -> "retat", verb forms match without diacritics. */
    private static String fold(String text) {
        return Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
