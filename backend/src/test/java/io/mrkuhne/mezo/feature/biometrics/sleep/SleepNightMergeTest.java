package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepNightMerge;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepNightMerge.Entry;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepNightMerge.HealthNight;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class SleepNightMergeTest {

    private static HealthNight health() {
        return new HealthNight("hk-1", "23:40", "06:50", new BigDecimal("6.83"), 430, 22, 228, 98, 80,
            new SleepHypnogram(5, "LLDDRR"), "Sleep Cycle", 52);
    }

    private static Entry entry(Integer quality, Integer pct, Integer awakenings, String bed, String source) {
        return new Entry(bed, bed == null ? null : "07:00", bed == null ? null : new BigDecimal("8.00"), quality,
            awakenings, null, null, null, null, null, null, pct, null, source);
    }

    private static SleepLogEntity manualRow() {
        SleepLogEntity r = new SleepLogEntity();
        r.setSource("manual");
        r.setBedtime("22:00");
        r.setWakeup("06:00");
        r.setDurationH(new BigDecimal("8.00"));
        r.setQuality(7);
        r.setAwakenings(2);
        return r;
    }

    @Test
    void healthOntoManualTakesSensorFieldsAndKeepsSubjective() {
        SleepLogEntity row = manualRow();
        SleepNightMerge.applyHealth(row, health());
        assertThat(row.getSource()).isEqualTo("apple_health");
        assertThat(row.getBedtime()).isEqualTo("23:40");
        assertThat(row.getWakeup()).isEqualTo("06:50");
        assertThat(row.getDurationH()).isEqualByComparingTo("6.83");
        assertThat(row.getDeepMin()).isEqualTo(80);
        assertThat(row.getHypnogram().stages()).isEqualTo("LLDDRR");
        assertThat(row.getSleepingHr()).isEqualTo(52);
        assertThat(row.getSourceApp()).isEqualTo("Sleep Cycle");
        assertThat(row.getExternalId()).isEqualTo("hk-1");
        assertThat(row.getQuality()).isEqualTo(7);
        assertThat(row.getAwakenings()).isEqualTo(2);
    }

    @Test
    void healthOntoScreenshotKeepsSourceQualityPctAndOwnStagesWhereHealthHasNone() {
        SleepLogEntity row = manualRow();
        row.setSource("screenshot");
        row.setSourceQualityPct(81);
        row.setHypnogram(new SleepHypnogram(10, "DDLL"));
        HealthNight noStages = new HealthNight("hk-2", "23:40", "06:50", new BigDecimal("6.83"), null, null, null,
            null, null, null, null, null);
        SleepNightMerge.applyHealth(row, noStages);
        assertThat(row.getSourceQualityPct()).isEqualTo(81);
        assertThat(row.getHypnogram().stages()).isEqualTo("DDLL");
    }

    @Test
    void healthResyncOverwritesTheSensorSideWholesale() {
        SleepLogEntity row = new SleepLogEntity();
        SleepNightMerge.applyHealth(row, health());
        HealthNight later = new HealthNight("hk-1", "23:50", "07:00", new BigDecimal("7.00"), null, null, null,
            null, null, null, null, null);
        SleepNightMerge.applyHealth(row, later);
        assertThat(row.getBedtime()).isEqualTo("23:50");
        assertThat(row.getDeepMin()).isNull();
        assertThat(row.getHypnogram()).isNull();
        assertThat(row.getSleepingHr()).isNull();
    }

    @Test
    void entryOntoHealthRowAppliesOnlySubjective() {
        SleepLogEntity row = new SleepLogEntity();
        SleepNightMerge.applyHealth(row, health());
        SleepNightMerge.applyEntry(row, entry(8, 74, 1, "21:00", "screenshot"));
        assertThat(row.getQuality()).isEqualTo(8);
        assertThat(row.getSourceQualityPct()).isEqualTo(74);
        assertThat(row.getAwakenings()).isEqualTo(1);
        assertThat(row.getBedtime()).isEqualTo("23:40");
        assertThat(row.getDurationH()).isEqualByComparingTo("6.83");
        assertThat(row.getSource()).isEqualTo("apple_health");
    }

    @Test
    void entryOntoHealthRowKeepsExistingSubjectiveWhereEntryHasNone() {
        SleepLogEntity row = new SleepLogEntity();
        SleepNightMerge.applyHealth(row, health());
        row.setQuality(6);
        SleepNightMerge.applyEntry(row, entry(null, 70, null, null, null));
        assertThat(row.getQuality()).isEqualTo(6);
        assertThat(row.getSourceQualityPct()).isEqualTo(70);
    }

    @Test
    void newerEntryReplacesWhatItProvidesOnAManualRow() {
        SleepLogEntity row = manualRow();
        SleepNightMerge.applyEntry(row, entry(9, null, null, "23:00", "screenshot"));
        assertThat(row.getQuality()).isEqualTo(9);
        assertThat(row.getAwakenings()).isEqualTo(2);
        assertThat(row.getBedtime()).isEqualTo("23:00");
        assertThat(row.getSource()).isEqualTo("screenshot");
    }

    @Test
    void demoteKeepsTimesAndSubjectiveOnly() {
        SleepLogEntity row = manualRow();
        SleepNightMerge.applyHealth(row, health());
        assertThat(SleepNightMerge.hasSubjective(row)).isTrue();
        SleepNightMerge.demoteToManual(row);
        assertThat(row.getSource()).isEqualTo("manual");
        assertThat(row.getExternalId()).isNull();
        assertThat(row.getHypnogram()).isNull();
        assertThat(row.getDeepMin()).isNull();
        assertThat(row.getSourceApp()).isNull();
        assertThat(row.getSleepingHr()).isNull();
        assertThat(row.getBedtime()).isEqualTo("23:40");
        assertThat(row.getQuality()).isEqualTo(7);
    }

    @Test
    void healthOnlyRowHasNoSubjective() {
        SleepLogEntity row = new SleepLogEntity();
        SleepNightMerge.applyHealth(row, health());
        assertThat(SleepNightMerge.hasSubjective(row)).isFalse();
    }
}
