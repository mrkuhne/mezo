package io.mrkuhne.mezo.feature.penz.config;

import io.mrkuhne.mezo.feature.penz.service.PenzSmsKeyService;
import io.mrkuhne.mezo.feature.penz.service.PenzSmsKeyService.KeyOwner;
import io.mrkuhne.mezo.feature.penz.service.PenzSmsRateLimiter;
import io.mrkuhne.mezo.feature.penz.service.sms.PenzSmsKeys;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * The API-key authentication of {@code POST /api/penz/sms/ingest} (Boop Pénz L4, mezo-r36n9.102, spec §10.1.7),
 * installed ONLY in the ingest's own filter chain ({@link PenzSmsSecurityConfig}) — never a servlet-wide bean.
 *
 * <p>The key comes from {@code X-Api-Key} or {@code Authorization: Bearer mzp_…} ({@link PenzSmsKeys#extract}); a
 * missing, unknown or revoked key answers 401 {@code PENZ_SMS_KEY_INVALID} before the body is read. A live key
 * then passes the per-key rate limit (429 {@code PENZ_SMS_RATE_LIMITED} + {@code Retry-After}) and its owner
 * becomes the principal in the SAME shape the JWT resource server builds — a {@link JwtAuthenticationToken} over
 * a {@link Jwt} whose subject is the owner id and whose {@code iat} is now — so {@code CurrentUser} (account
 * status check), {@code created_by}, the LLM actor and the message language resolve unchanged. The synthetic
 * token is never signed and never leaves the request. Errors render through the MVC exception handlers (the usual
 * {@code SystemMessage} list). Neither the key nor the body is ever logged.
 */
public class PenzSmsApiKeyFilter extends OncePerRequestFilter {

    /** The authority an API-key principal carries — and the only one. */
    public static final String AUTHORITY = "PENZ_SMS_INGEST";
    /** Claim naming the key the principal came from (diagnostics; the subject is the owner). */
    public static final String KEY_ID_CLAIM = "penz_api_key_id";

    private final PenzSmsKeyService keys;
    private final PenzSmsRateLimiter limiter;
    private final HandlerExceptionResolver exceptionResolver;
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    public PenzSmsApiKeyFilter(PenzSmsKeyService keys, PenzSmsRateLimiter limiter,
                               HandlerExceptionResolver exceptionResolver) {
        this.keys = keys;
        this.limiter = limiter;
        this.exceptionResolver = exceptionResolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String key = PenzSmsKeys.extract(request.getHeader(PenzSmsKeys.HEADER),
            request.getHeader(HttpHeaders.AUTHORIZATION));
        Optional<KeyOwner> owner = key == null ? Optional.empty() : keys.authenticate(key);
        if (owner.isEmpty()) {
            reject(request, response, "PENZ_SMS_KEY_INVALID", HttpStatus.UNAUTHORIZED);
            return;
        }
        PenzSmsRateLimiter.Decision decision = limiter.tryAcquire(owner.get().keyId());
        if (!decision.allowed()) {
            response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(decision.retryAfterSeconds()));
            reject(request, response, "PENZ_SMS_RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS);
            return;
        }
        Instant now = Instant.now();
        Jwt principal = Jwt.withTokenValue("penz-sms-key")
            .header("alg", "none")
            .subject(owner.get().owner().toString())
            .issuedAt(now)
            .expiresAt(now.plusSeconds(60))
            .claim(KEY_ID_CLAIM, owner.get().keyId().toString())
            .build();
        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(new JwtAuthenticationToken(principal, List.of(new SimpleGrantedAuthority(AUTHORITY)),
            owner.get().owner().toString()));
        contextHolder.setContext(context);
        try {
            chain.doFilter(request, response);
        } finally {
            contextHolder.clearContext();
        }
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, String code, HttpStatus status) {
        exceptionResolver.resolveException(request, response, null,
            new SystemRuntimeErrorException(SystemMessage.error(code).build(), status));
    }
}
