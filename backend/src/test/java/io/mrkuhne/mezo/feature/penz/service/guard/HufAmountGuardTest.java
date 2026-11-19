package io.mrkuhne.mezo.feature.penz.service.guard;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * The Boop Pénz extensions of the amount guard (mezo-r36n9.102, spec 2026-11-13-boop-penz-design §6): the
 * figure parser on the spellings an LLM and a bank SMS actually produce, the verdict against the computed
 * inputs, and the SMS cross-check. The 1:1 port of the old app's cases lives in {@link HufAmountGuardPortedTest}.
 */
class HufAmountGuardTest {

    private static final String SMS =
        "MBH Bank: Kartyas vasarlas -15 500 HUF, MOL 1093 BUDAORS, 2026.11.11 08:17. Egyenleg: 412 380 HUF";

    // ---- hufAmountsMinor: separators, suffixes, units, signs ----

    @Test
    void parsesEveryThousandsSeparator() {
        assertThat(HufAmountGuard.hufAmountsMinor("15 500 Ft · 15 500 Ft · 15 500 Ft · 15 500 Ft · 15.500 Ft"))
            .containsExactly(1_550_000L, 1_550_000L, 1_550_000L, 1_550_000L, 1_550_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("1 234 567 Ft és 1.234.567 Ft")).containsExactly(123_456_700L, 123_456_700L);
        assertThat(HufAmountGuard.hufAmountsMinor("15 500 Ft, 15 500 HUF, HUF 250, 15 ezer forint"))
            .containsExactly(1_550_000L, 1_550_000L, 25_000L, 1_500_000L);
    }

    @Test
    void parsesHungarianCaseSuffixes() {
        assertThat(HufAmountGuard.hufAmountsMinor(
            "15 500 Ft-od, 15 500 Ft-ot, 15 500 Ft-tal, 15 500 Ft-ból, 15 500 HUF-ot, 15 500 forinttal, 15 500 forintból"))
            .hasSize(7)
            .containsOnly(1_550_000L);
    }

    @Test
    void parsesForintHufAndPrefixedHuf() {
        assertThat(HufAmountGuard.hufAmountsMinor("250 forint, 250 HUF, HUF 250, 250 Ft, 250 FT"))
            .containsExactly(25_000L, 25_000L, 25_000L, 25_000L, 25_000L);
    }

    @Test
    void signsAreDroppedAndTheMagnitudeIsReturned() {
        assertThat(HufAmountGuard.hufAmountsMinor("-15 500 HUF, +250 000 Ft, −15 500 Ft"))
            .containsExactly(1_550_000L, 25_000_000L, 1_550_000L);
    }

    @Test
    void parsesCommaDecimals() {
        assertThat(HufAmountGuard.hufAmountsMinor("1 234,56 Ft és 99,5 Ft")).containsExactly(123_456L, 9_950L);
    }

    @Test
    void parsesTheWordUnits() {
        assertThat(HufAmountGuard.hufAmountsMinor("15 ezer forint")).containsExactly(1_500_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("1,2 millió Ft")).containsExactly(120_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("2 milliárd forint")).containsExactly(200_000_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("1,25 millió forintot")).containsExactly(125_000_000L);
    }

    @Test
    void bareMillionAndBillionWordsCountAsMoneyFigures() {
        // A Pénz text saying "2 milliárd" without a currency still names money; erring towards a figure only downgrades.
        assertThat(HufAmountGuard.hufAmountsMinor("A cél 2 milliárd, a tartalék 1,5 milliót ér.")).containsExactly(200_000_000_000L, 150_000_000L);
        // ...but a bare "ezer" stays unread (old rule: "10 ezerből" is not a figure).
        assertThat(HufAmountGuard.hufAmountsMinor("10 ezer lépés, 10 ezerből")).isEmpty();
    }

    @Test
    void doesNotOverMatchDatesTimesStoreNumbersOrPercentages() {
        assertThat(HufAmountGuard.hufAmountsMinor("2026.11.11 08:17, MOL 1093 BUDAORS, 12 %, 12%-kal, 3 db, 2026-ban, EUR/HUF 410,5"))
            .isEmpty();
    }

    @Test
    void readsTheBankSmsFigures() {
        assertThat(HufAmountGuard.hufAmountsMinor(SMS)).containsExactly(1_550_000L, 41_238_000L);
    }

    @Test
    void emptyAndNullTextHaveNoFigures() {
        assertThat(HufAmountGuard.hufAmountsMinor("")).isEmpty();
        assertThat(HufAmountGuard.hufAmountsMinor(null)).isEmpty();
    }

    // ---- containsAmount: the SMS cross-check ----

    @Test
    void containsAmount_matchesAFigureLiterallyInTheSms() {
        assertThat(HufAmountGuard.containsAmount(SMS, 1_550_000L)).isTrue();
        assertThat(HufAmountGuard.containsAmount(SMS, -1_550_000L)).isTrue(); // an expense may be passed signed
        assertThat(HufAmountGuard.containsAmount(SMS, 41_238_000L)).isTrue();
    }

    @Test
    void containsAmount_rejectsAnAmountThatIsNotThere() {
        assertThat(HufAmountGuard.containsAmount(SMS, 155_000L)).isFalse(); // 1 550 Ft: an LLM dropping a zero
        assertThat(HufAmountGuard.containsAmount(SMS, 109_300L)).isFalse(); // the store number
        assertThat(HufAmountGuard.containsAmount(SMS, 202_600L)).isFalse(); // the year
        assertThat(HufAmountGuard.containsAmount(null, 1_550_000L)).isFalse();
    }

    // ---- verdict ----

    @Test
    void verdict_isOk_whenTheTextNamesNoMoney() {
        GuardVerdict v = HufAmountGuard.verdict("Nyugodt hét, nincs teendő.", Set.of(), 0L);
        assertThat(v.isOk()).isTrue();
        assertThat(v.offendingMinor()).isEmpty();
    }

    @Test
    void verdict_isOk_whenEveryFigureIsAnInputUnderTheMax() {
        GuardVerdict v = HufAmountGuard.verdict("Még 22 700 Ft maradt, 15 500 Ft-ot költöttél.", Set.of(2_270_000L, 1_550_000L), 3_000_000L);
        assertThat(v.outcome()).isEqualTo(GuardVerdict.Outcome.OK);
    }

    @Test
    void verdict_downgrades_aFigureThatIsNotAnInput() {
        GuardVerdict v = HufAmountGuard.verdict("Még 22 700 Ft maradt, tegyél félre 10 000 Ft-ot.", Set.of(2_270_000L), 3_000_000L);
        assertThat(v.outcome()).isEqualTo(GuardVerdict.Outcome.DOWNGRADE);
        assertThat(v.offendingMinor()).containsExactly(1_000_000L);
    }

    @Test
    void verdict_downgrades_anInputAboveTheMax() {
        GuardVerdict v = HufAmountGuard.verdict("A fizetésed 450 000 Ft.", Set.of(45_000_000L), 3_000_000L);
        assertThat(v.outcome()).isEqualTo(GuardVerdict.Outcome.DOWNGRADE);
        assertThat(v.offendingMinor()).containsExactly(45_000_000L);
    }

    @Test
    void verdict_doesNotTolerateDerivedSums() {
        // 22 700 + 15 500 = 38 200: a sum of two inputs is still a figure the engine did not compute.
        GuardVerdict v = HufAmountGuard.verdict("Összesen 38 200 Ft.", Set.of(2_270_000L, 1_550_000L), 30_000_000L);
        assertThat(v.offendingMinor()).containsExactly(3_820_000L);
    }

    @Test
    void verdict_toleratesAnInputRoundedToWholeForints() {
        // The engine holds 22 700,40 Ft; the text says 22 700 Ft (how hufText formats it).
        assertThat(HufAmountGuard.verdict("Még 22 700 Ft maradt.", Set.of(2_270_040L), 3_000_000L).isOk()).isTrue();
        // A signed input (an expense) matches its magnitude in the text.
        assertThat(HufAmountGuard.verdict("15 500 Ft-ot költöttél.", Set.of(-1_550_000L), 3_000_000L).isOk()).isTrue();
    }

    @Test
    void verdict_listsEachOffendingFigureOnceInTextOrder() {
        GuardVerdict v = HufAmountGuard.verdict("50 000 Ft, 10 000 Ft, 50 000 Ft, 22 700 Ft", Set.of(2_270_000L), 3_000_000L);
        assertThat(v.offendingMinor()).containsExactly(5_000_000L, 1_000_000L);
    }

    @Test
    void verdict_withANegativeMax_downgradesAnyFigure() {
        // No known limit (the old stale / null limit): pass a negative max, every figure downgrades.
        assertThat(HufAmountGuard.verdict("Még 22 700 Ft maradt.", Set.of(2_270_000L), -1L).isOk()).isFalse();
    }

    // ---- fixtures: a realistic generated paragraph ----

    private static final Set<Long> FIXTURE_INPUTS = Set.of(18_430_000L, 2_270_000L, 1_550_000L);
    private static final long FIXTURE_MAX = 30_000_000L;

    @Test
    void fixture_paragraphNamingMoreMoneyThanAllowed_isDowngradedWithExactlyThatFigure() throws IOException {
        GuardVerdict v = HufAmountGuard.verdict(fixture("penz/guard-brief-overspend.txt"), FIXTURE_INPUTS, FIXTURE_MAX);
        assertThat(v.outcome()).isEqualTo(GuardVerdict.Outcome.DOWNGRADE);
        assertThat(v.offendingMinor()).containsExactly(4_500_000L);
    }

    @Test
    void fixture_consistentParagraph_isOk() throws IOException {
        String text = fixture("penz/guard-brief-consistent.txt");
        assertThat(HufAmountGuard.hufAmountsMinor(text)).containsExactly(18_430_000L, 2_270_000L, 1_550_000L, 2_270_000L);
        assertThat(HufAmountGuard.verdict(text, FIXTURE_INPUTS, FIXTURE_MAX).isOk()).isTrue();
    }

    private static String fixture(String path) throws IOException {
        try (InputStream in = HufAmountGuardTest.class.getClassLoader().getResourceAsStream(path)) {
            assertThat(in).as(path).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
