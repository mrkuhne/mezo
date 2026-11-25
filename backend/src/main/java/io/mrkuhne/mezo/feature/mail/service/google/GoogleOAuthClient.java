package io.mrkuhne.mezo.feature.mail.service.google;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.MailErrors;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Google's OAuth endpoints for the owner's own Gmail (spec §12): the authorization-code exchange, the refresh and
 * the revoke, as an iOS public client (client id, PKCE verifier, NO client secret). The endpoints are fixed to the
 * two Google hosts ({@link MailProperties.Google}; only a test points them at a stub). Codes, verifiers and tokens
 * are never logged and never put in an exception. A refused grant is {@code MAIL_AUTH_FAILED}; a network error or a
 * 5xx is {@code MAIL_UNREACHABLE}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class GoogleOAuthClient {

    /** What a code exchange yields; {@code toString} shows no token. */
    public record Tokens(String refreshToken, String accessToken, Instant expiresAt, String email) {
        @Override
        public String toString() {
            return "Tokens[" + email + "]";
        }
    }

    /** A fresh access token; {@code toString} shows no token. */
    public record AccessToken(String token, Instant expiresAt) {
        @Override
        public String toString() {
            return "AccessToken[expires " + expiresAt + "]";
        }
    }

    static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Logger LOG = LoggerFactory.getLogger(GoogleOAuthClient.class);
    private static final ObjectMapper JSON = JsonMapper.builder().build();

    private final MailProperties.Google google;
    private final Clock clock;
    private final RestClient rest;

    @Autowired
    public GoogleOAuthClient(MailProperties properties) {
        this(properties.google(), Clock.systemUTC());
    }

    GoogleOAuthClient(MailProperties.Google google, Clock clock) {
        this.google = google;
        this.clock = clock;
        HttpClientSettings settings = HttpClientSettings.defaults().withTimeouts(TIMEOUT, TIMEOUT);
        this.rest = RestClient.builder().requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /** Trades the one-time code for tokens; the address comes from the verified-email ID token. */
    public Tokens exchange(String code, String codeVerifier, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", google.clientId());
        form.add("code", code);
        form.add("code_verifier", codeVerifier);
        form.add("redirect_uri", redirectUri);
        JsonNode body = post(google.tokenUrl(), form);
        String refresh = text(body, "refresh_token");
        String access = text(body, "access_token");
        String email = emailFrom(text(body, "id_token"));
        if (refresh == null || access == null || email == null) {
            throw MailErrors.authFailed();
        }
        return new Tokens(refresh, access, expiry(body), email);
    }

    /** A fresh access token for a stored refresh token; a withdrawn grant ({@code invalid_grant}) is auth failed. */
    public AccessToken refresh(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("client_id", google.clientId());
        form.add("refresh_token", refreshToken);
        JsonNode body = post(google.tokenUrl(), form);
        String access = text(body, "access_token");
        if (access == null) {
            throw MailErrors.authFailed();
        }
        return new AccessToken(access, expiry(body));
    }

    /** Revokes the grant at Google (the refresh token revokes it all); throws MAIL_UNREACHABLE on a failure. */
    public void revoke(String token) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", token);
        try {
            rest.post().uri(google.revokeUrl()).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form)
                .retrieve().toBodilessEntity();
        } catch (RestClientException e) {
            LOG.warn("google revoke failed: {}", e.getClass().getSimpleName());
            throw unreachable();
        }
    }

    private JsonNode post(String url, MultiValueMap<String, String> form) {
        try {
            String raw = rest.post().uri(url).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form)
                .retrieve().body(String.class);
            return JSON.readTree(raw == null ? "{}" : raw);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            LOG.warn("google token endpoint answered {}", status);
            if (status == 429 || status >= 500) {
                throw unreachable();
            }
            throw MailErrors.authFailed(); // invalid_grant, invalid_client, redirect mismatch: the grant is unusable
        } catch (RestClientException | JacksonException e) {
            LOG.warn("google token endpoint unreachable: {}", e.getClass().getSimpleName());
            throw unreachable();
        }
    }

    private Instant expiry(JsonNode body) {
        long seconds = body.path("expires_in").asLong(3600);
        return clock.instant().plusSeconds(seconds);
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isString() && !v.asString().isBlank() ? v.asString() : null;
    }

    /** Decodes the ID token payload (it came straight from Google over TLS) and checks audience, issuer, email. */
    private String emailFrom(String idToken) {
        if (idToken == null) {
            return null;
        }
        String[] parts = idToken.split("\\.");
        if (parts.length < 2) {
            return null;
        }
        JsonNode claims;
        try {
            claims = JSON.readTree(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException | JacksonException e) {
            return null;
        }
        if (!audienceMatches(claims.path("aud"))) {
            return null;
        }
        String iss = claims.path("iss").asString("");
        if (!"accounts.google.com".equals(iss) && !"https://accounts.google.com".equals(iss)) {
            return null;
        }
        JsonNode verified = claims.path("email_verified");
        if (!(verified.isBoolean() ? verified.asBoolean() : "true".equals(verified.asString()))) {
            return null;
        }
        return text(claims, "email");
    }

    private boolean audienceMatches(JsonNode aud) {
        if (aud.isArray()) {
            for (JsonNode a : aud) {
                if (google.clientId().equals(a.asString())) {
                    return true;
                }
            }
            return false;
        }
        return google.clientId().equals(aud.asString(null));
    }

    private static SystemRuntimeErrorException unreachable() {
        return MailErrors.unreachable();
    }
}
