package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.train.GymWeekChanged;
import io.mrkuhne.mezo.feature.train.MesocycleStarted;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * When the plan under the day-adjustment ledger changes, the ledger lets the plan win (Boop B7 K3 final review
 * rulings, {@link DayAdjustmentService#settleForPlanChange}):
 * <ul>
 *   <li>a block starts running ({@link MesocycleStarted}: a planned block reaching its day through
 *   {@code PlannedBlockStarter}, a manual activation, or a start-as-active stamp) — the old block's live session
 *   changes settle;</li>
 *   <li>the gym week is re-written ({@link GymWeekChanged}: a new gym schedule, or the season's Módosítás
 *   re-arranging the running block's days) — moves that no longer fit expire.</li>
 * </ul>
 *
 * <p>Synchronous, inside the writing transaction, on purpose: the same request (the today-workout read calls
 * {@code startDue} first) reads the ledger right after, and must already see the stale moves gone — an after-commit
 * listener would leave a moved session pointing at a day the plan no longer holds. The sweep never marks the
 * transaction rollback-only (it skips a row it cannot judge), and anything else it throws is logged and swallowed:
 * a block start or a plan change must never fail because of the ledger.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NewBlockListener {

    private final DayAdjustmentService ledger;

    @EventListener
    public void onBlockStarted(MesocycleStarted event) {
        settle(event.userId(), true, "New active block " + event.mesocycleId());
    }

    @EventListener
    public void onGymWeekChanged(GymWeekChanged event) {
        settle(event.userId(), false, "Gym week re-written");
    }

    private void settle(java.util.UUID owner, boolean newBlock, String what) {
        try {
            int changed = ledger.settleForPlanChange(owner, newBlock).size();
            if (changed > 0) {
                log.info("{}: {} day adjustment(s) settled against the new plan", what, changed);
            }
        } catch (RuntimeException e) {
            log.warn("{}: the day-adjustment sweep failed and is skipped", what, e);
        }
    }
}
