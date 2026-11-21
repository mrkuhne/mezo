package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.YearReconciler.Change;
import io.mrkuhne.mezo.feature.train.service.YearReconciler.MesoState;
import io.mrkuhne.mezo.feature.train.service.YearReconciler.Row;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** A year block's status follows its linked mesocycle (mezo-r36n9.113, controller call 2). */
class YearReconcilerTest {

    private static final UUID BLOCK = UUID.randomUUID();
    private static final UUID MESO = UUID.randomUUID();

    private static List<Change> one(String blockStatus, MesoState meso) {
        Map<UUID, MesoState> mesos = meso == null ? Map.of() : Map.of(MESO, meso);
        return YearReconciler.reconcile(List.of(new Row(BLOCK, blockStatus, MESO)), mesos);
    }

    @Test
    void activeIsRunning() {
        assertThat(one("planned", new MesoState("active", false, false)))
            .containsExactly(new Change(BLOCK, "running", false));
        assertThat(one("running", new MesoState("active", true, false))).isEmpty();
    }

    @Test
    void plannedMesoKeepsPlanned() {
        assertThat(one("planned", new MesoState("planned", false, false))).isEmpty();
    }

    @Test
    void archivedWithLogsIsDone() {
        assertThat(one("running", new MesoState("archived", true, false)))
            .containsExactly(new Change(BLOCK, "done", false));
    }

    @Test
    void archivedWithoutLogsIsSkipped() {
        assertThat(one("running", new MesoState("archived", false, false)))
            .containsExactly(new Change(BLOCK, "skipped", false));
    }

    @Test
    void deletedUnlinksToPlanned() {
        assertThat(one("planned", new MesoState("planned", false, true)))
            .containsExactly(new Change(BLOCK, "planned", true));
        // a mesocycle that no longer loads at all (soft-deleted rows are filtered) counts as deleted
        assertThat(one("running", null)).containsExactly(new Change(BLOCK, "planned", true));
    }

    @Test
    void runningWithoutMesocycleNormalisesToPlanned() {
        assertThat(YearReconciler.reconcile(List.of(new Row(BLOCK, "running", null)), Map.of()))
            .containsExactly(new Change(BLOCK, "planned", false));
        // an owner-skipped or done block without a link is left alone
        assertThat(YearReconciler.reconcile(List.of(new Row(BLOCK, "skipped", null), new Row(UUID.randomUUID(),
            "done", null)), Map.of())).isEmpty();
    }
}
