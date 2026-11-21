package io.mrkuhne.mezo.feature.mail;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.MailCredentialCipher;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** An enabled mail feature without MEZO_MAIL_SECRET_KEY must fail at startup (no baked-in default key). */
class MailSecretKeyRequiredTest {

    @Configuration
    @EnableConfigurationProperties(MailProperties.class)
    static class Cfg {
        @Bean
        MailCredentialCipher cipher(MailProperties p) {
            return new MailCredentialCipher(p);
        }
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner().withUserConfiguration(Cfg.class);

    @Test
    void enabledWithBlankKeyFailsToStart() {
        runner.withPropertyValues("mezo.mail.secret-key=").run(ctx -> assertThat(ctx).hasFailed());
    }

    @Test
    void enabledWithMissingKeyFailsToStart() {
        runner.run(ctx -> assertThat(ctx).hasFailed());
    }
}
