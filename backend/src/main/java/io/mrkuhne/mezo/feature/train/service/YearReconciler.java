package io.mrkuhne.mezo.feature.train.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A year block's status follows its linked mesocycle (mezo-r36n9.113, controller call 2), reconciled on read instead
 * of hooking every close / archive / discard path. Pure:
 *
 * <ul>
 *   <li>active mesocycle → {@code running}; a still-planned one keeps the block {@code planned} ("indul …");</li>
 *   <li>archived with ≥ 1 logged session → {@code done}, with none → {@code skipped};</li>
 *   <li>deleted (discarded, or no longer loading at all) → unlinked, back to {@code planned};</li>
 *   <li>a {@code running} block with no mesocycle (a stale state, e.g. its run moved to a newer plan) → {@code planned}.
 *       An unlinked {@code done}/{@code skipped} block is left alone (an owner skip has no mesocycle).</li>
 * </ul>
 */
public final class YearReconciler {

    private YearReconciler() {}

    /** One block as stored. */
    public record Row(UUID blockId, String status, UUID mesocycleId) {}

    /** The linked mesocycle; {@code hasLogs} = any instance row of the run (as {@code MesocycleDiscardService}). */
    public record MesoState(String status, boolean hasLogs, boolean deleted) {}

    /** The block's new status; {@code unlink} clears its {@code mesocycle_id}. */
    public record Change(UUID blockId, String status, boolean unlink) {}

    /** Only the blocks that change; a mesocycle missing from {@code mesos} counts as deleted. */
    public static List<Change> reconcile(List<Row> rows, Map<UUID, MesoState> mesos) {
        List<Change> out = new ArrayList<>();
        for (Row r : rows) {
            if (r.mesocycleId() == null) {
                if (YearGenerator.RUNNING.equals(r.status())) out.add(new Change(r.blockId(), YearGenerator.PLANNED, false));
                continue;
            }
            MesoState m = mesos.get(r.mesocycleId());
            if (m == null || m.deleted()) {
                out.add(new Change(r.blockId(), YearGenerator.PLANNED, true));
                continue;
            }
            String status = switch (m.status()) {
                case "active" -> YearGenerator.RUNNING;
                case "archived" -> m.hasLogs() ? YearGenerator.DONE : YearGenerator.SKIPPED;
                default -> YearGenerator.PLANNED;
            };
            if (!status.equals(r.status())) out.add(new Change(r.blockId(), status, false));
        }
        return out;
    }
}
