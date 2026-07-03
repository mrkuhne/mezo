package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Manual real-API round-trip proof (ADR 0008): streams a Hungarian hello through whichever
 * {@link CompanionLlm} is active and logs the chunks. Opt-in only — run with
 * {@code ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata,companion-smoke}
 * and a real {@code GEMINI_API_KEY} in the environment.
 */
@Component
@Profile("companion-smoke")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@Order(1000)
@RequiredArgsConstructor
@Slf4j
public class CompanionHelloRunner implements CommandLineRunner {

    private final CompanionLlm companionLlm;

    @Override
    public void run(String... args) {
        log.info("companion-smoke: streaming hello through {}…", companionLlm.getClass().getSimpleName());
        companionLlm
            .stream(
                "Te vagy a mezo companion. Valaszolj magyarul, egyetlen rovid mondatban.",
                "Koszonj Danielnek!")
            .doOnNext(chunk -> log.info("companion-smoke chunk: [{}]", chunk))
            .blockLast();
        log.info("companion-smoke: done — round-trip proven.");
    }
}
