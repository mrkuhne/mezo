package io.mrkuhne.mezo.feature.llmlog.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the price-list YAML shape against a SILENT failure: model ids contain dots, and an
 * unbracketed map key is split into separate property elements by the binder — the entry then
 * vanishes from the map, every call prices as "unknown model", and no error is ever raised.
 * Binds the real {@code application.yml} through a plain {@link Binder} (no Spring context, no DB).
 */
class LlmPricingPropertiesBindingTest {

    private Binder applicationYmlBinder() throws IOException {
        StandardEnvironment env = new StandardEnvironment();
        List<PropertySource<?>> sources =
            new YamlPropertySourceLoader().load("application.yml", new ClassPathResource("application.yml"));
        sources.forEach(env.getPropertySources()::addFirst);
        return new Binder(ConfigurationPropertySources.get(env));
    }

    @Test
    void testPricingBinding_shouldKeepDottedModelIdsAsMapKeys_whenBoundFromApplicationYml() throws IOException {
        LlmPricingProperties pricing =
            applicationYmlBinder().bind("mezo.llm-log.pricing", LlmPricingProperties.class).get();

        assertThat(pricing.currency()).isEqualTo("USD");
        assertThat(pricing.models())
            .containsKeys("gemini-2.5-flash", "gemini-2.5-pro", "gemini-embedding-001");

        ModelPrice flash = pricing.models().get("gemini-2.5-flash");
        assertThat(flash.inputPerMillion()).isEqualByComparingTo("0.30");
        assertThat(flash.outputPerMillion()).isEqualByComparingTo("2.50");
        assertThat(flash.thinkingPerMillion()).isEqualByComparingTo("2.50");
        assertThat(flash.cachedPerMillion()).isEqualByComparingTo("0.075");
        assertThat(pricing.models().get("gemini-embedding-001").embedPerMillionChars())
            .isEqualByComparingTo("0.15");
    }

    @Test
    void testLlmLogBinding_shouldReadPayloadCapAndExecutor_whenBoundFromApplicationYml() throws IOException {
        LlmLogProperties props = applicationYmlBinder().bind("mezo.llm-log", LlmLogProperties.class).get();

        assertThat(props.maxPayloadChars()).isEqualTo(64_000);
        assertThat(props.executor().coreSize()).isEqualTo(1);
        assertThat(props.executor().maxSize()).isEqualTo(2);
        assertThat(props.executor().queueCapacity()).isEqualTo(500);
    }
}
