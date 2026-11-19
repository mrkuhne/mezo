package io.mrkuhne.mezo.feature.penz.config;

import io.mrkuhne.mezo.feature.penz.service.PenzSmsKeyService;
import io.mrkuhne.mezo.feature.penz.service.PenzSmsRateLimiter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * The SMS-ingest filter chain (Boop Pénz L4, mezo-r36n9.102, spec §10.1.7): matches ONLY
 * {@code /api/penz/sms/ingest} and is ordered before the main JWT chain of {@code techcore.security.SecurityConfig}
 * (which matches everything else). It has no JWT resource server — a JWT on the ingest is not a key and answers
 * 401 — and the API-key filter exists in no other chain, so a key is accepted nowhere else (there the main chain's
 * JWT decoder rejects {@code Bearer mzp_…} and ignores {@code X-Api-Key}).
 */
@Configuration
public class PenzSmsSecurityConfig {

    public static final String INGEST_PATH = "/api/penz/sms/ingest";

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE + 10)
    SecurityFilterChain penzSmsIngestChain(HttpSecurity http, PenzSmsKeyService keys, PenzSmsRateLimiter limiter,
                                           @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver)
        throws Exception {
        http
            .securityMatcher(INGEST_PATH)
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .anonymous(a -> a.disable())
            .requestCache(c -> c.disable())
            .addFilterBefore(new PenzSmsApiKeyFilter(keys, limiter, resolver), BearerTokenAuthenticationFilter.class)
            .authorizeHttpRequests(auth -> auth.anyRequest().hasAuthority(PenzSmsApiKeyFilter.AUTHORITY));
        return http.build();
    }
}
