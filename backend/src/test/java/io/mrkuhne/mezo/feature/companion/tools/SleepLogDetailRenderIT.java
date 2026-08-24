package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * get_recovery(scope=sleep) detail mode — on-demand full sleep-log rows (mezo-ohce). Spec:
 * docs/superpowers/specs/2026-08-24-sleep-log-detail-tool-design.md §3/§4/§6. Same package and
 * framework as CompanionToolsRenderIT; kept separate because that file is already 1.4k lines.
 * Detail rows are null-guarded: absent fields are omitted, never a fabricated value.
 */
class SleepLogDetailRenderIT extends AbstractIntegrationTest {

    @Autowired private BiometricsTools biometricsTools;
    @Autowired private SleepLogRepository sleepLogRepository;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private ToolCallAudit audit;

    // Verbatim mirror of CompanionToolsRenderIT's ctx helper (that file:106-112).
    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testSleepLogRepository_shouldReturnInclusiveNewestFirst_whenDateBetween() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(2), new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(5), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(9), new BigDecimal("5.0"), 2);

        List<SleepLogEntity> rows = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
                        owner, LocalDate.now().minusDays(7), LocalDate.now());

        assertThat(rows).extracting(SleepLogEntity::getDate)
                .containsExactly(LocalDate.now().minusDays(2), LocalDate.now().minusDays(5));
    }

    // ---- spec §6.1 — one date, fully populated tracker row -> every field on one line ----

    @Test
    void testRenderDetailOneDate_shouldRenderFullLine_whenRowIsPopulated() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createTrackerSleepLog(owner, d, "23:15", "06:45", new BigDecimal("7.5"),
                4, 2, 480, 12, 210, 90, 68, 87, "screenshot",
                new SleepHypnogram(10, "DDRRLDLRA"), "korán keltem");

        String out = biometricsTools.getRecovery("sleep", null, List.of(d), null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvás — részletes nézet:\n"
                + d + ": lefekvés 23:15, ébredés 06:45; 7h 30p; ágyban 480p; ébren 12p · könnyű 210p · REM 90p · mély 68p; "
                + "minőség 4/5; ébredések 2; forrás: screenshot (87%); hypnogram: 10 DDRRLDLRA; megjegyzés: korán keltem");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Sleep", d.toString()));
    }

    // ---- spec §6.2 — two dates -> each rendered, newest first ----

    @Test
    void testRenderDetailMultipleDates_shouldRenderEachNewestFirst_whenTwoOrThreeDates() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d3 = LocalDate.now().minusDays(3);
        LocalDate d1 = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d3, new BigDecimal("6.0"), 3);
        sleepLogPopulator.createSleepLog(owner, d1, new BigDecimal("8.0"), 5);

        String out = biometricsTools.getRecovery("sleep", null, List.of(d3, d1), null, null, ctx(owner));

        assertThat(out).startsWith("Alvás — részletes nézet:\n");
        int newer = out.indexOf(d1.toString());
        int older = out.indexOf(d3.toString());
        assertThat(newer).isPositive().isLessThan(older); // newest first
        assertThat(out).contains(d1 + ": 8h").contains(d3 + ": 6h");
        assertThat(out).doesNotContain(LocalDate.now().minusDays(2).toString());
    }

    // ---- spec §6.3a — from only (to omitted -> today) ----

    @Test
    void testRenderDetailFromOnly_shouldUseTodayAsTo_whenToOmitted() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d3 = LocalDate.now().minusDays(3);
        LocalDate d2 = LocalDate.now().minusDays(2);
        sleepLogPopulator.createSleepLog(owner, d3, new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, d2, new BigDecimal("7.2"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now(), new BigDecimal("6.8"), 3);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(6), new BigDecimal("5.5"), 2);

        String out = biometricsTools.getRecovery("sleep", null, null, d3, null, ctx(owner));

        assertThat(out).startsWith("Alvás — részletes nézet:\n");
        assertThat(out).contains(d2.toString()).contains(d3.toString()).contains(LocalDate.now().toString());
        assertThat(out).doesNotContain(LocalDate.now().minusDays(6).toString()); // before `from`
    }

    // ---- spec §6.3b — from + to, every logged day in range ----

    @Test
    void testRenderDetailFromTo_shouldRenderEveryLoggedDayInRange_whenRangeGiven() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d5 = LocalDate.now().minusDays(5);
        LocalDate d2 = LocalDate.now().minusDays(2);
        sleepLogPopulator.createSleepLog(owner, d5, new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(3), new BigDecimal("7.4"), 4);
        sleepLogPopulator.createSleepLog(owner, d2, new BigDecimal("6.9"), 3);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(6), new BigDecimal("5.0"), 2);

        String out = biometricsTools.getRecovery("sleep", null, null, d5, d2, ctx(owner));

        assertThat(out).contains(d5.toString())
                .contains(LocalDate.now().minusDays(3).toString())
                .contains(d2.toString())
                .doesNotContain(LocalDate.now().minusDays(6).toString());
    }

    // ---- spec §6.4 — range wider than the window cap -> clamped, trimmed header ----
    // application.yml pins max-window-days=30 for tests (same fixture CompanionToolsRenderIT:180
    // relies on). A 60-day request must clamp to 30 days back and announce the trim.

    @Test
    void testRenderDetailWideRange_shouldClampToWindow_andShowTrimmedCount_inHeader() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(2), new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(40), new BigDecimal("5.0"), 2);

        String out = biometricsTools.getRecovery(
                "sleep", null, null, LocalDate.now().minusDays(59), null, ctx(owner));

        assertThat(out).startsWith("Alvás — részletes nézet, visszavágva 30 napra:\n");
        assertThat(out).contains(LocalDate.now().minusDays(2).toString());
        assertThat(out).doesNotContain(LocalDate.now().minusDays(40).toString());
    }

    // ---- spec §6.5 — requested day without a row -> explicit "nothing" ----

    @Test
    void testRenderDetailMissingDay_shouldRenderExplicitNothingLine_whenNoRowOnDay() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate empty = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(4), new BigDecimal("7.0"), 4);

        String out = biometricsTools.getRecovery("sleep", null, List.of(empty), null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvás — részletes nézet:\n" + empty + ": nincs rögzített alvás");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Sleep", empty.toString()));
    }

    // ---- spec §6.6a — screenshot row: tracker fields + hypnogram (asserted in §6.1's full line) ----

    // ---- spec §6.6b — manual sparse row: only populated fields, nothing fabricated ----

    @Test
    void testRenderDetailManualRow_shouldOmitAbsentFields_whenSparse() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d, "23:40", "07:05", new BigDecimal("7.4"), 3, 1, null);

        String out = biometricsTools.getRecovery("sleep", null, List.of(d), null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvás — részletes nézet:\n"
                + d + ": lefekvés 23:40, ébredés 07:05; 7h 24p; minőség 3/5; ébredések 1; forrás: manual");
        assertThat(out).doesNotContain("ágyban").doesNotContain("hypnogram")
                .doesNotContain("megjegyzés").doesNotContain("forrás: screenshot");
    }

    // ---- spec §6.7 — detail params on scope=checkins -> ignored, existing output ----

    @Test
    void testRenderDetailParams_shouldBeIgnored_whenScopeCheckins() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, LocalDate.now().minusDays(1), "08:00", 7, 3, null);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);

        String out = biometricsTools.getRecovery("checkins", null, List.of(LocalDate.now().minusDays(1)),
                LocalDate.now().minusDays(3), null, ctx(owner));

        assertThat(out).startsWith("Bejelentkezések (utolsó 7 nap):\n");
        assertThat(out).contains(LocalDate.now().minusDays(1) + " 08:00: energia 7/10");
        assertThat(out).doesNotContain("részletes").doesNotContain("lefekvés");
    }

    // ---- spec §6.7 — detail params on scope=sleep-goal -> ignored, existing output ----

    @Test
    void testRenderDetailParams_shouldBeIgnored_whenScopeSleepGoal() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);

        String out = biometricsTools.getRecovery("sleep-goal", null, List.of(LocalDate.now()),
                null, null, ctx(owner));

        assertThat(out).isEqualTo(
                "Alvási cél: 7ó 30p alvás, ébredés 06:45, lefekvés 23:15; szabályosság ±15 perc");
        assertThat(out).doesNotContain("részletes");
    }

    // ---- spec §6.8 — default call, no new params -> byte-identical compact output ----

    @Test
    void testRenderDetailAbsentParams_shouldKeepCompactOutput_whenNoDateParams() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);

        String out = biometricsTools.getRecovery("sleep", 7, null, null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvás (utolsó 7 nap):\n"
                + LocalDate.now().minusDays(1) + ": 7.5 h, minőség 4/5");
    }
}
