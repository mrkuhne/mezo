package io.mrkuhne.mezo.techcore.webpush;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class VapidSignerTest {

    private static final Base64.Decoder B64URL = Base64.getUrlDecoder();

    @Test
    void testAuthorizationHeader_shouldProduceVerifiableEs256Jwt_whenSignedWithTheConfiguredKey() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair kp = g.generateKeyPair();

        String pub = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(VapidSigner.encodePublicKey((ECPublicKey) kp.getPublic()));
        String priv = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(VapidSigner.encodePrivateKey((ECPrivateKey) kp.getPrivate()));

        VapidSigner signer = new VapidSigner(
            new WebPushProperties("mailto:a@b.c", pub, priv, 3600, 5000));

        String header = signer.authorizationHeader("https://web.push.apple.com", Instant.parse("2026-07-29T06:00:00Z"));

        assertThat(header).startsWith("vapid t=").contains(", k=" + pub);
        String jwt = header.substring("vapid t=".length(), header.indexOf(", k="));
        String[] parts = jwt.split("\\.");
        assertThat(parts).hasSize(3);

        // The JOSE signature must be exactly 64 raw bytes (r‖s), NOT DER.
        byte[] sig = B64URL.decode(parts[2]);
        assertThat(sig).hasSize(64);

        // And it must verify against the public key once converted back to DER.
        Signature v = Signature.getInstance("SHA256withECDSA");
        v.initVerify(kp.getPublic());
        v.update((parts[0] + "." + parts[1]).getBytes("UTF-8"));
        assertThat(v.verify(VapidSigner.joseToDer(sig))).isTrue();

        String payload = new String(B64URL.decode(parts[1]), "UTF-8");
        assertThat(payload).contains("\"aud\":\"https://web.push.apple.com\"")
            .contains("\"sub\":\"mailto:a@b.c\"")
            .contains("\"exp\":");
    }
}
