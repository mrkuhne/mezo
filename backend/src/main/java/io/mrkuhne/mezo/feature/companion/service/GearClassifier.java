package io.mrkuhne.mezo.feature.companion.service;

import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * The cheap tie-breaker for turns {@code TurnGearAnalyzer} could not classify. One tool-less,
 * history-less call on the cheap tier, answering with exactly one enumerated word.
 *
 * <p>Deliberately NOT given the conversation history or any context block: its whole job is to
 * look at one sentence, and anything more would cost what the gear exists to save.
 *
 * <p><b>Gated on the companion switch</b> (mezo-rj214.7): the Spring constructor needs a
 * {@code CompanionLlm}, and every {@code CompanionLlm} bean is itself gated on that switch
 * ({@code GeminiCompanionLlm}, {@code OpenAiCompanionLlm}). Without this condition the whole
 * context fails to load with the companion off — an {@code UnsatisfiedDependencyException} on
 * {@code gearClassifier} that cascades through {@code TurnGearRouter}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GearClassifier {

    /** Public so {@code FakeCompanionLlm} can dispatch on it — the fake keys on the prompt prefix. */
    public static final String PROMPT = """
        FOKOZAT-BESOROLAS. Egyetlen felhasznaloi mondatot kapsz. Dontsd el, melyik igaz ra:
        - CHAT: nem a felhasznalo sajat naplozott adatarol szol (altalanos kerdes, koszones, velemeny).
        - LOOKUP: a sajat adatabol egy konkret ertek kell (mennyi, mikor, mi volt).
        - ANALYSIS: a sajat adatainak ertelmezese kell (miert, mi valtozott, mit tegyen).
        Valaszolj KIZAROLAG egyetlen szoval: CHAT vagy LOOKUP vagy ANALYSIS.""";

    /** The narrow slice of the LLM port this needs — keeps the unit test free of a full fake. */
    @FunctionalInterface
    public interface CheapCompletion {
        String complete(String systemPrompt, String userMessage);
    }

    private final CheapCompletion completion;

    public GearClassifier(CheapCompletion completion) {
        this.completion = completion;
    }

    @Autowired
    public GearClassifier(CompanionLlm llm) {
        this(llm::complete);
    }

    /** Empty when the provider failed or answered something that is not one of the three words. */
    public Optional<TurnGear> classify(String userMessage) {
        try {
            String answer = completion.complete(PROMPT, userMessage);
            if (answer == null) {
                return Optional.empty();
            }
            String word = answer.trim().toUpperCase(Locale.ROOT);
            for (TurnGear gear : TurnGear.values()) {
                if (word.startsWith(gear.name())) {
                    return Optional.of(gear);
                }
            }
            return Optional.empty();
        } catch (RuntimeException e) {
            // Fail-open: a classifier outage must never cost the user their answer.
            return Optional.empty();
        }
    }
}
