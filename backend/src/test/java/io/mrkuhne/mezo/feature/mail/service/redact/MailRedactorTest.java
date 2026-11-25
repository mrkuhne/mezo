package io.mrkuhne.mezo.feature.mail.service.redact;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MailRedactorTest {

    private static RedactedMail html(String h) {
        return MailRedactor.redact(null, h, 6000);
    }

    @Test
    void prefersPlainText() {
        RedactedMail r = MailRedactor.redact("Szia, ez a sima szöveg.", "<p>HTML változat</p>", 6000);
        assertThat(r.text()).isEqualTo("Szia, ez a sima szöveg.");
    }

    @Test
    void htmlStrippedOfStyleScriptAttributes() {
        RedactedMail r = html("<html><head><title>T</title><style>p{color:red}</style></head>"
                + "<body><!-- rejtett --><p class=\"x\" style=\"a:b\" onclick=\"evil()\">Üdv</p>"
                + "<script>alert(1)</script></body></html>");
        assertThat(r.text()).isEqualTo("Üdv");
    }

    @Test
    void imagesDropped() {
        RedactedMail r = html("<p>Kép <img src=\"https://cdn.example/pixel.png\" alt=\"pixel\"> vége</p>");
        assertThat(r.text()).doesNotContain("pixel").contains("Kép").contains("vége");
    }

    @Test
    void linkBecomesAnchorPlusBareHost() {
        RedactedMail r = html("<p><a href=\"https://shop.example/p?u=tok\">Cipő</a></p>");
        assertThat(r.text()).isEqualTo("Cipő (shop.example)");
        assertThat(r.text()).doesNotContain("tok");
        assertThat(r.hosts()).containsExactly("shop.example");
    }

    @Test
    void masksIdentifiers() {
        String body = "Írj ide: minta.nev@example.org. Kártya 4111 1111 1111 1111, "
                + "IBAN HU42 1177 3016 1111 1018 0000 0000, hívj: +36 30 123 4567 vagy 06 20 555 1234, "
                + "tracking 123456789012, rendelésszám: AB12345.";
        String t = MailRedactor.redact(body, null, 6000).text();
        assertThat(t).doesNotContain("minta.nev", "4111", "HU42", "1177", "123 4567", "555 1234",
                "123456789012", "AB12345");
        assertThat(t).contains("[azonosító]");
    }

    @Test
    void keepsDatesAmountsCarrierAndStatus() {
        String body = "GLS csomag átvehető. Fizetési határidő: 2026.12.05, összeg 12 990 Ft.";
        String t = MailRedactor.redact(body, null, 6000).text();
        assertThat(t).isEqualTo(body);
    }

    @Test
    void truncatesToCap() {
        RedactedMail r = MailRedactor.redact("a".repeat(500), null, 100);
        assertThat(r.text()).hasSize(100);
    }

    @Test
    void extractsJsonLdBeforeSanitizing() {
        RedactedMail r = html("<html><head><script type=\"application/ld+json\">"
                + "{\"@type\":\"ParcelDelivery\"}</script></head><body><p>Szia</p></body></html>");
        assertThat(r.jsonLd()).containsExactly("{\"@type\":\"ParcelDelivery\"}");
        assertThat(r.text()).isEqualTo("Szia").doesNotContain("ParcelDelivery");
    }

    @Test
    void plainTextKeepsDigitsUnmasked() {
        assertThat(MailRedactor.plainText(null, "<p>Csomagszám 123456789012</p>")).isEqualTo("Csomagszám 123456789012");
        assertThat(MailRedactor.plainText("sima 123456789012", "<p>x</p>")).isEqualTo("sima 123456789012");
    }

    @Test
    void urlAsAnchorLabelLeaksNothing() {
        RedactedMail r = html("<a href=\"https://track.example/x?tok=abc\">https://track.example/x?tok=abc</a>");
        assertThat(r.text()).isEqualTo("track.example");
    }

    @Test
    void urlInTextNodeLeaksNothing() {
        RedactedMail r = html("<p>Nézd: https://track.example/x?tok=abc itt</p>");
        assertThat(r.text()).isEqualTo("Nézd: track.example itt");
        assertThat(r.hosts()).containsExactly("track.example");
    }

    @Test
    void entitiesComeOutLiterally() {
        RedactedMail r = html("<p>Tom &amp; Jerry, 5 &lt; 6</p>");
        assertThat(r.text()).isEqualTo("Tom & Jerry, 5 < 6");
    }

    @Test
    void schemelessWwwUrlReducedToBareHost() {
        String t = MailRedactor.redact("Nézd meg: www.shop.example/akcio?token=abc123&u=77 még ma.", null, 6000).text();
        assertThat(t).isEqualTo("Nézd meg: www.shop.example még ma.");
        assertThat(t).doesNotContain("token", "abc123", "akcio");
    }

    @Test
    void publicMaskMasksSubjectIdentifiers() {
        String t = MailRedactor.mask("Rendelésszám: AB12345 minta.nev@example.org");
        assertThat(t).doesNotContain("AB12345", "minta.nev");
    }
}
