package io.mrkuhne.mezo.feature.mail.service.rules;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.mail.service.redact.RedactedMail;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MailRulesTest {

    private static MailHeaders h(String from, String subject, Map<String, List<String>> raw) {
        return new MailHeaders(from, "", subject, raw);
    }

    private static RedactedMail body(String text) {
        return new RedactedMail(text, List.of(), List.of());
    }

    private static RuleVerdict decide(MailHeaders h, RedactedMail b, SenderRule... rules) {
        return MailRules.decide(h, b, List.of(rules));
    }

    @Test
    void seedSensitiveDomainsAreSensitive() {
        for (String from : List.of("info@ugyfel.otpbank.hu", "noreply@nav.gov.hu", "x@allianz.hu", "y@eeszt.gov.hu")) {
            assertThat(decide(h(from, "Értesítés", Map.of()), body("szöveg")))
                    .as(from).isInstanceOf(RuleVerdict.Sensitive.class);
        }
    }

    @Test
    void verificationCodeIsSensitive() {
        RuleVerdict v = decide(h("service@shop.example", "Your verification code is 123456", Map.of()), body(""));
        assertThat(v).isEqualTo(new RuleVerdict.Sensitive("2fa"));
    }

    @Test
    void ownerSensitiveRuleWinsOverAlways() {
        MailHeaders hd = h("a@clinic.example", "Hi", Map.of());
        assertThat(decide(hd, body("x"), new SenderRule("@clinic.example", SenderRule.Kind.ALWAYS),
                new SenderRule("a@clinic.example", SenderRule.Kind.SENSITIVE)))
                .isInstanceOf(RuleVerdict.Sensitive.class);
    }

    @Test
    void ownerSilentBeatsBulk() {
        MailHeaders hd = h("deals@news.example", "Akció", Map.of("List-Unsubscribe", List.of("<mailto:u@x>")));
        RuleVerdict v = decide(hd, body("x"), new SenderRule("@news.example", SenderRule.Kind.SILENT));
        assertThat(v).isEqualTo(new RuleVerdict.Rest("csendben"));
    }

    @Test
    void domainRuleMatchesSubdomainsButNotLookalikes() {
        SenderRule r = new SenderRule("@news.example", SenderRule.Kind.SILENT);
        assertThat(r.matches("a@mail.news.example")).isTrue();
        assertThat(r.matches("a@notnews.example")).isFalse();
        assertThat(new SenderRule("Pat@X.example", SenderRule.Kind.SILENT).matches("pat@x.EXAMPLE")).isTrue();
    }

    @Test
    void ownerAlwaysMakesBulkSenderAPerson() {
        MailHeaders hd = h("club@news.example", "Hello", Map.of("List-Unsubscribe", List.of("<u>")));
        assertThat(decide(hd, body("x"), new SenderRule("club@news.example", SenderRule.Kind.ALWAYS)))
                .isEqualTo(new RuleVerdict.Person());
    }

    @Test
    void jsonLdParcelDeliveryIsStructured() {
        RedactedMail b = new RedactedMail("x", List.of(), List.of(
                "{\"@context\":\"https://schema.org\",\"@type\":\"ParcelDelivery\",\"trackingNumber\":\"T1\","
                        + "\"expectedArrivalUntil\":\"2026-12-02\"}"));
        RuleVerdict v = decide(h("orders@shop.example", "Csomag", Map.of()), b);
        assertThat(v).isInstanceOf(RuleVerdict.Structured.class);
        assertThat(((RuleVerdict.Structured) v).group()).isEqualTo(Group.PARCEL);
    }

    @Test
    void knownRestSenderGoesToRestWithCategory() {
        assertThat(decide(h("update@facebookmail.com", "Valaki jelölt", Map.of()), body("x")))
                .isEqualTo(new RuleVerdict.Rest("közösségi"));
    }

    @Test
    void personToPersonMailIsPerson() {
        assertThat(decide(h("anna@example.org", "Szombat?", Map.of()), body("Ráérsz szombaton?")))
                .isEqualTo(new RuleVerdict.Person());
    }

    @Test
    void unsubscribeHeaderMeansBulkNeedsModel() {
        MailHeaders hd = h("hello@brand.example", "Új kollekció", Map.of("list-unsubscribe", List.of("<u>")));
        assertThat(decide(hd, body("x"))).isEqualTo(new RuleVerdict.NeedsModel(true));
        assertThat(BulkDetector.isBulk(h("a@b.example", "s", Map.of("Precedence", List.of("bulk"))))).isTrue();
    }

    @Test
    void viaReadsEachHeader() {
        assertThat(MailRules.via(h("a@b.example", "s", Map.of("X-Forwarded-For", List.of("me@icloud.com mirror@gmail.com")))))
                .isEqualTo("icloud");
        assertThat(MailRules.via(h("a@b.example", "s", Map.of("X-Forwarded-To", List.of("mirror@gmail.com")))))
                .isEqualTo("gmail");
        assertThat(MailRules.via(h("a@b.example", "s", Map.of("To", List.of("Me <me@me.com>")))))
                .isEqualTo("icloud");
        assertThat(MailRules.via(h("a@b.example", "s", Map.of()))).isEqualTo("unknown");
    }
}
