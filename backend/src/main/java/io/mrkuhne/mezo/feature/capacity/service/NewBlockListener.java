package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.train.MesocycleActivated;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * When a block becomes the active mesocycle — a planned block starting mid-week ({@code PlannedBlockStarter}) or a
 * manual activation — the day-adjustment ledger lets the plan win (Boop B7 K3 final review ruling): the old block's
 * live session changes expire ({@link DayAdjustmentService#expireForNewBlock}).
 *
 * <p>Synchronous, inside the activating transaction, on purpose: the same request (the today-workout read calls
 * {@code startDue} first) reads the ledger right after, and must already see the old moves gone — an after-commit
 * listener would leave a moved session pointing into the archived block, so it would vanish from both days. A failure
 * here is logged and swallowed: the block start must never fail because of a ledger sweep.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NewBlockListener {

    private final DayAdjustmentService ledger;

    @EventListener
    public void onMesocycleActivated(MesocycleActivated event) {
        try {
            int expired = ledger.expireForNewBlock(event.userId(), event.mesocycleId()).size();
            if (expired > 0) {
                log.info("New active block {}: {} day adjustment(s) of the old block expired", event.mesocycleId(),
                    expired);
            }
        } catch (RuntimeException e) {
            log.warn("New active block {}: the day-adjustment sweep failed and is skipped", event.mesocycleId(), e);
        }
    }
}
