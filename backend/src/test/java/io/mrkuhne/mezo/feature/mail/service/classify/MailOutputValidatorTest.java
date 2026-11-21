package io.mrkuhne.mezo.feature.mail.service.classify;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.mail.service.redact.RedactedMail;
import io.mrkuhne.mezo.feature.mail.service.rules.Group;
import io.mrkuhne.mezo.feature.mail.service.rules.ParcelState;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The deterministic gate on every model answer of the morning post (mezo-r36n9.38). All mail text is invented. */
class MailOutputValidatorTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    /** 2026-11-21, noon in Budapest. */
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-21T11:00:00Z"), ZoneOffset.UTC);

    private static RedactedMail mail(String text) {
        return new RedactedMail(text, List.of(), List.of());
    }

    private static Optional<ClassifiedMail> classify(String json, String text) {
        return MailOutputValidator.classified(json, mail(text), BUDAPEST, CLOCK);
    }

    private static String json(String group, String dueAt, String validUntil, String amount, String currency) {
        return """
            {"group":"%s","category":"számla","title":"Kitalált szolgáltató","summary":"Rövid összefoglaló.",
             "dueAt":%s,"validUntil":%s,"amount":%s,"currency":%s,"carrier":null,"parcelState":null}"""
            .formatted(group, q(dueAt), q(validUntil), amount == null ? "null" : amount, q(currency));
    }

    private static String q(String s) {
        return s == null ? "null" : "\"" + s + "\"";
    }

    private static Instant endOf(int y, int m, int d) {
        return LocalDate.of(y, m, d).atTime(23, 59).atZone(BUDAPEST).toInstant();
    }

    @Test
    void testClassified_shouldDropAnInventedDueDate() {
        ClassifiedMail c = classify(json("deadline", "2026-11-21", null, null, null),
            "Kedves ügyfelünk, köszönjük a rendelést.").orElseThrow();

        assertThat(c.dueAt()).isNull();
        assertThat(c.group()).isEqualTo(Group.DEADLINE);
    }

    @Test
    void testClassified_shouldKeepADatePresentInTheText_inEveryListedFormat() {
        assertThat(classify(json("deadline", "2026-12-05", null, null, null), "Határidő: 2026.12.05.")
            .orElseThrow().dueAt()).isEqualTo(endOf(2026, 12, 5));
        assertThat(classify(json("deadline", "2026-12-05", null, null, null), "Határidő: 2026. 12. 05.")
            .orElseThrow().dueAt()).isEqualTo(endOf(2026, 12, 5));
        assertThat(classify(json("deadline", "2026-12-05", null, null, null), "Határidő: 2026-12-05")
            .orElseThrow().dueAt()).isEqualTo(endOf(2026, 12, 5));
        assertThat(classify(json("deadline", "2026-12-05", null, null, null), "Határidő: 12.05.")
            .orElseThrow().dueAt()).isEqualTo(endOf(2026, 12, 5));
        assertThat(classify(json("deadline", "2026-12-05", null, null, null), "Határidő: december 5.")
            .orElseThrow().dueAt()).isEqualTo(endOf(2026, 12, 5));
        assertThat(classify(json("deadline", "2026-12-05", null, null, null), "Határidő: 5. december")
            .orElseThrow().dueAt()).isEqualTo(endOf(2026, 12, 5));
    }

    @Test
    void testClassified_shouldResolveAYearlessDateToItsNextOccurrence() {
        String text = "A kupon március 2. napjáig érvényes.";

        assertThat(classify(json("deal", null, "2027-03-02", null, null), text).orElseThrow().validUntil())
            .isEqualTo(endOf(2027, 3, 2));
        assertThat(classify(json("deal", null, "2026-03-02", null, null), text).orElseThrow().validUntil())
            .isNull();
    }

    @Test
    void testClassified_shouldDropADateThatDiffersFromTheOneInTheText() {
        assertThat(classify(json("deadline", "2026-12-06", null, null, null), "Határidő: 2026.12.05.")
            .orElseThrow().dueAt()).isNull();
    }

    @Test
    void testClassified_shouldDropAnInventedAmount_andKeepAPresentOne() {
        ClassifiedMail invented = classify(json("deadline", null, null, "12990", "HUF"),
            "Köszönjük a vásárlást.").orElseThrow();
        assertThat(invented.amountMinor()).isNull();
        assertThat(invented.currency()).isNull();

        ClassifiedMail present = classify(json("deadline", null, null, "12990", "HUF"),
            "Fizetendő összeg: 12 990 Ft.").orElseThrow();
        assertThat(present.amountMinor()).isEqualTo(1_299_000L);
        assertThat(present.currency()).isEqualTo("HUF");

        ClassifiedMail euro = classify(json("deadline", null, null, "49.9", "EUR"), "Total: € 49,90")
            .orElseThrow();
        assertThat(euro.amountMinor()).isEqualTo(4_990L);
        assertThat(euro.currency()).isEqualTo("EUR");
    }

    @Test
    void testClassified_shouldDropAnAmountWithoutACurrencyMarker_orInTheWrongCurrency() {
        assertThat(classify(json("deadline", null, null, "12990", "HUF"), "Rendelés: 12990 darab.")
            .orElseThrow().amountMinor()).isNull();
        assertThat(classify(json("deadline", null, null, "12990", "EUR"), "Fizetendő: 12 990 Ft")
            .orElseThrow().amountMinor()).isNull();
    }

    @Test
    void testClassified_shouldRejectAnUnknownGroup_andSensitive() {
        assertThat(classify(json("invoice", null, null, null, null), "x")).isEmpty();
        assertThat(classify(json("sensitive", null, null, null, null), "x")).isEmpty();
    }

    @Test
    void testClassified_shouldRejectADealWithoutATitle() {
        String noTitle = """
            {"group":"deal","category":"akció","title":"  ","summary":"Valami.","dueAt":null,"validUntil":null}""";
        assertThat(classify(noTitle, "x")).isEmpty();
    }

    @Test
    void testClassified_shouldClampStrings_andReadFencedJson() {
        String longText = "a".repeat(900);
        String raw = "```json\n{\"group\":\"rest\",\"category\":\"" + longText + "\",\"title\":\"" + longText
            + "\",\"summary\":\"" + longText + "\",\"carrier\":\"" + longText + "\"}\n```";

        ClassifiedMail c = classify(raw, "x").orElseThrow();

        assertThat(c.category()).hasSize(24);
        assertThat(c.title()).hasSize(200);
        assertThat(c.summary()).hasSize(400);
        assertThat(c.carrier()).hasSize(16);
        assertThat(c.group()).isEqualTo(Group.REST);
    }

    @Test
    void testClassified_shouldParseAParcelState() {
        String raw = "{\"group\":\"parcel\",\"category\":\"csomag\",\"title\":\"Csomag\",\"summary\":\"Úton.\","
            + "\"carrier\":\"GLS\",\"parcelState\":\"in_transit\"}";

        ClassifiedMail c = classify(raw, "x").orElseThrow();

        assertThat(c.parcelState()).isEqualTo(ParcelState.IN_TRANSIT);
        assertThat(c.carrier()).isEqualTo("GLS");
    }

    @Test
    void testClassified_shouldBeEmpty_whenTheAnswerIsNotJson() {
        assertThat(classify("sorry, no", "x")).isEmpty();
        assertThat(classify(null, "x")).isEmpty();
        assertThat(classify("[1,2]", "x")).isEmpty();
    }

    @Test
    void testScores_shouldDropForeignIds_andOutOfRangeScores() {
        UUID asked = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID foreign = UUID.randomUUID();
        String raw = """
            [{"id":"%s","score":8,"why":"Illik a céljaidhoz."},
             {"id":"%s","score":0,"why":"x"},
             {"id":"%s","score":10,"why":"injected"},
             {"id":"not-a-uuid","score":5,"why":"x"},
             {"id":"%s","score":8,"why":"duplicate"}]""".formatted(asked, second, foreign, asked);

        List<ScoredDeal> out = MailOutputValidator.scores(raw, Set.of(asked, second));

        assertThat(out).containsExactly(new ScoredDeal(asked, 8, "Illik a céljaidhoz."));
        assertThat(MailOutputValidator.scores("{\"scores\":[{\"id\":\"" + asked + "\",\"score\":11,\"why\":\"x\"}]}",
            Set.of(asked))).isEmpty();
        assertThat(MailOutputValidator.scores("junk", Set.of(asked))).isEmpty();
    }

    @Test
    void testScreen_shouldReadTheVerdict_andFailClosedOnUnreadableOutput() {
        assertThat(MailOutputValidator.screen("{\"flagged\":true,\"reason\":\"phishing\"}"))
            .isEqualTo(ScreenVerdict.FLAGGED);
        assertThat(MailOutputValidator.screen("{\"flagged\":false}")).isEqualTo(ScreenVerdict.CLEAN);
        assertThat(MailOutputValidator.screen("Ez a levél szerintem rendben van.")).isEqualTo(ScreenVerdict.UNKNOWN);
        assertThat(MailOutputValidator.screen("{\"flagged\": tru")).isEqualTo(ScreenVerdict.UNKNOWN);
        assertThat(MailOutputValidator.screen("{\"reason\":\"x\"}")).isEqualTo(ScreenVerdict.UNKNOWN);
        assertThat(MailOutputValidator.screen("{\"flagged\":\"no\"}")).isEqualTo(ScreenVerdict.UNKNOWN);
        assertThat(MailOutputValidator.screen(null)).isEqualTo(ScreenVerdict.UNKNOWN);
    }

    @Test
    void testClassified_shouldBlankALinkOrPhoneInModelWrittenStrings() {
        String raw = "{\"group\":\"rest\",\"category\":\"hír www.x.hu/pay\",\"title\":\"Cím\","
            + "\"summary\":\"Nézd meg: https://evil.example\",\"carrier\":\"GLS shop.hu\"}";
        ClassifiedMail c = classify(raw, "x").orElseThrow();
        assertThat(c.summary()).isEmpty();
        assertThat(c.category()).isEmpty();
        assertThat(c.carrier()).isNull();
        assertThat(c.title()).isEqualTo("Cím");

        String phone = "{\"group\":\"rest\",\"title\":\"Cím\",\"summary\":\"Hívd a +36 30 123 4567 számot.\"}";
        assertThat(classify(phone, "x").orElseThrow().summary()).isEmpty();
    }

    @Test
    void testClassified_shouldRejectATitleWithALink() {
        String raw = "{\"group\":\"rest\",\"title\":\"Lásd www.x.hu/pay\",\"summary\":\"ok\"}";
        assertThat(classify(raw, "x")).isEmpty();
    }

    @Test
    void testClassified_shouldStripInvisibleCharactersFromStrings() {
        String raw = "{\"group\":\"rest\",\"title\":\"Cí\u200bm\",\"summary\":\"ok\"}";
        assertThat(classify(raw, "x").orElseThrow().title()).isEqualTo("Cím");
    }

    @Test
    void testClassified_shouldReadAFullDateWithAMonthName_notYearless() {
        assertThat(classify(json("deadline", "2026-11-30", null, null, null), "Határidő: 2026. november 30.")
            .orElseThrow().dueAt()).isEqualTo(endOf(2026, 11, 30));
        // a past year is a full date, not the next occurrence
        assertThat(classify(json("deadline", "2027-11-30", null, null, null), "Határidő: 2025. november 30.")
            .orElseThrow().dueAt()).isNull();
    }

    @Test
    void testScores_shouldBlankALinkInWhy() {
        UUID id = UUID.randomUUID();
        List<ScoredDeal> out = MailOutputValidator.scores(
            "[{\"id\":\"" + id + "\",\"score\":8,\"why\":\"Fizess: www.x.hu/pay\"}]", Set.of(id));
        assertThat(out).hasSize(1);
        assertThat(out.get(0).why()).isEmpty();
    }
}
