package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.config.FactTextBackfillProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * S8 (mezo-d6ivw.12): the ops trigger of {@link FactTextBackfillService}. {@code
 * mezo.companion.fact-text-backfill.mode}: {@code off} (default — nothing happens), {@code dry-run}
 * (logs every before/after pair, writes nothing) or {@code apply} (rewrites, logs the same list).
 * Production sets it for ONE deploy through the Deployment env
 * {@code MEZO_COMPANION_FACTTEXTBACKFILL_MODE} and removes it afterwards; {@code apply} needs the
 * owner's explicit OK on the dry-run list (CLAUDE.md §Production database access).
 */
@Slf4j
@Component
@Order(300)
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactTextBackfillRunner implements CommandLineRunner {

    static final String MODE_DRY_RUN = "dry-run";
    static final String MODE_APPLY = "apply";

    private final FactTextBackfillService service;
    private final UserFanOut userFanOut;
    private final FactTextBackfillProperties properties;

    @Override
    public void run(String... args) {
        execute(properties.mode());
    }

    public int execute(String requestedMode) {
        if (!MODE_DRY_RUN.equals(requestedMode) && !MODE_APPLY.equals(requestedMode)) {
            return 0;
        }
        boolean apply = MODE_APPLY.equals(requestedMode);
        AtomicInteger total = new AtomicInteger();
        userFanOut.forEachActiveUser("fact-text-backfill", user -> {
            List<FactTextBackfillService.Change> changes = apply ? service.apply(user.getId()) : service.plan(user.getId());
            changes.forEach(c -> log.info("fact-text-backfill [{}] user={} fact={} muted={}\n  ELŐTTE: {}\n  UTÁNA:  {}",
                    requestedMode, user.getId(), c.factId(), c.muted(), c.before(), c.after()));
            total.addAndGet(changes.size());
        });
        log.info("fact-text-backfill [{}] done — {} row(s) {}", requestedMode, total.get(),
                apply ? "rewritten" : "would change");
        return total.get();
    }
}
