package io.mrkuhne.mezo.techcore.webpush;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Config-shape coverage for {@link WebPushProperties}: the two rules that decide whether a bad
 * deploy fails <i>loudly at the right moment</i> or takes something unrelated down with it.
 */
class WebPushPropertiesTest {

    private static WebPushProperties properties(String subject, String privateKey) {
        return new WebPushProperties(subject, "dummy-vapid-public", privateKey, 3600, 5000);
    }

    private static jakarta.validation.ConstraintViolation<WebPushProperties> firstViolation(
        WebPushProperties value) {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            var violations = validator.validate(value);
            return violations.isEmpty() ? null : violations.iterator().next();
        }
    }

    @Test
    void testValidation_shouldRejectSubject_whenItIsNeitherMailtoNorHttps() {
        // RFC 8292 §2.1 allows only these two forms, and `subject` is spliced unescaped into the
        // signed JWT claims — so a bad value must be caught at startup, not produce tokens that
        // every push service 401s.
        assertThat(firstViolation(properties("daniel.kuhne@intuitech.studio", "k")))
                .isNotNull()
                .satisfies(v -> assertThat(v.getPropertyPath()).hasToString("subject"));
        assertThat(firstViolation(properties("http://example.com/contact", "k"))).isNotNull();
        assertThat(firstViolation(properties("mailto:", "k"))).isNotNull(); // needs a contact after it
    }

    @Test
    void testValidation_shouldAcceptSubject_whenItIsAMailtoOrHttpsContact() {
        assertThat(firstViolation(properties("mailto:daniel.kuhne@intuitech.studio", "k"))).isNull();
        assertThat(firstViolation(properties("https://mezo.example/contact", "k"))).isNull();
    }

    @Test
    void testConstructor_shouldTreatABlankKeyAsAbsent_whenTheEnvVarIsPresentButEmpty() {
        // `${VAPID_PRIVATE:dummy-vapid-private}` does NOT substitute for an empty value, so an
        // empty SealedSecret entry would otherwise trip @NotBlank and abort context startup for the
        // whole application — even with notifications switched off.
        WebPushProperties blank = new WebPushProperties("mailto:t@example.com", "  ", "", 3600, 5000);

        assertThat(blank.publicKey()).isEqualTo(WebPushProperties.ABSENT_PUBLIC_KEY);
        assertThat(blank.privateKey()).isEqualTo(WebPushProperties.ABSENT_PRIVATE_KEY);
        assertThat(firstViolation(blank)).isNull(); // and therefore boots
    }

    @Test
    void testAuthorizationHeader_shouldStillFailLoudly_whenTheKeyWasBlank() {
        // The normalisation above must not become tolerance: the placeholder is not a 32-byte
        // P-256 scalar, so the FIRST send still fails — the loud failure just moved from
        // "no application at all" to "the push that needed the key".
        VapidSigner signer = new VapidSigner(
            new WebPushProperties("mailto:t@example.com", "", "", 3600, 5000));

        assertThatExceptionOfType(SystemRuntimeErrorException.class)
                .isThrownBy(() -> signer.authorizationHeader("https://push.example", Instant.now()))
                .satisfies(e -> assertThat(e.getMessages().getFirst().getCode())
                        .isEqualTo("WEBPUSH_SIGN_FAILED"));
    }
}
