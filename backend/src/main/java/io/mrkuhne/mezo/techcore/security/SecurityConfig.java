package io.mrkuhne.mezo.techcore.security;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

@Configuration
public class SecurityConfig {

    private final byte[] secret;
    private final CorsProperties corsProperties;

    public SecurityConfig(OwnerProperties props, CorsProperties corsProperties) {
        this.secret = props.jwtSecret().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        this.corsProperties = corsProperties;
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, CorsConfigurationSource corsConfigurationSource)
        throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/actuator/health").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(jwt -> {}));
        return http.build();
    }

    /**
     * Browser CORS policy driven by {@code mezo.cors.allowed-origins}. The frontend sends a
     * {@code Authorization: Bearer} header (not cookies), so credentials stay off.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(corsProperties.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    JwtDecoder jwtDecoder() {
        SecretKeySpec key = new SecretKeySpec(secret, "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secret));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
