package io.mrkuhne.mezo.feature.penz.service.sms;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * The old {@code src/data/apiKeys.test.ts} (3 cases) with the {@code mzp_} prefix; the fourth old case
 * ({@code apiKeys.create.test.ts}: a new key revokes the other live ones) is
 * {@code PenzSmsIngestApiIT#keysAreCreatedOnceListedWithoutTheKeyAndANewKeyRevokesTheOld}.
 */
class PenzSmsKeysTest {

    @Test
    void sha256HexMatchesTheSharedVector() {
        assertThat(PenzSmsKeys.hash("ft_test_key"))
            .isEqualTo("c55775582807cd18d29c1ca2ebddf6985219452099c6c03f1f9d623e6be6a1de");
    }

    @Test
    void generateMzpPrefix43Base64UrlCharsHashAndLast4Consistent() {
        PenzSmsKeys.Generated g = PenzSmsKeys.generate();
        assertThat(g.plaintext()).matches("^mzp_[A-Za-z0-9_-]{43}$");
        assertThat(g.hash()).isEqualTo(PenzSmsKeys.hash(g.plaintext()));
        assertThat(g.last4()).isEqualTo(g.plaintext().substring(g.plaintext().length() - 4));
        assertThat(g.toString()).doesNotContain(g.plaintext());
    }

    @Test
    void twoKeysDiffer() {
        assertThat(PenzSmsKeys.generate().plaintext()).isNotEqualTo(PenzSmsKeys.generate().plaintext());
    }
}
