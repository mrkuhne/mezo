package io.mrkuhne.mezo.techcore.configuration;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.cfg.DateTimeFeature;

/**
 * Wire-format platform decision: incoming {@code OffsetDateTime}s KEEP the client's UTC offset.
 * Jackson's default ({@code ADJUST_DATES_TO_CONTEXT_TIME_ZONE} on) silently normalizes every
 * parsed timestamp to UTC — which breaks the app's day-attribution contract: the FE deliberately
 * sends offset-bearing wall-clock timestamps ({@code nowOffsetIso}) so that
 * {@code takenAt/administeredAt .toLocalDate()} is the BROWSER's calendar day. With the default
 * on, an intake/dose logged 00:00–02:00 local files to the PREVIOUS UTC day. (Jackson 3 moved
 * this to {@code DateTimeFeature}, which Boot 4.0.0 exposes no yml key for — hence a customizer
 * bean, not configuration.)
 */
@Configuration
public class JacksonConfiguration {

    @Bean
    JsonMapperBuilderCustomizer keepClientUtcOffset() {
        return builder -> builder.disable(DateTimeFeature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE);
    }
}
