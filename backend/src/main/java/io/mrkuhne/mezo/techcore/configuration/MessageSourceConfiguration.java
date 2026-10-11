package io.mrkuhne.mezo.techcore.configuration;

import java.nio.charset.StandardCharsets;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ResourceBundleMessageSource;

/**
 * The bilingual user-message bundles ({@code messages_hu} + {@code messages_en}, mezo-n4wf5.11).
 *
 * <p>Declared as a bean, not via {@code spring.messages.*}: Boot's auto-configuration only
 * switches on when a base {@code messages.properties} exists, and there is deliberately none —
 * Hungarian is a bundle like English, and the host locale must never pick a language.
 */
@Configuration
public class MessageSourceConfiguration {

    @Bean
    public MessageSource messageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("messages");
        source.setDefaultEncoding(StandardCharsets.UTF_8.name());
        source.setFallbackToSystemLocale(false);
        return source;
    }
}
