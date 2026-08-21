package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.journal.service.DecisionContextPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the journal-owned {@link DecisionContextPort} (ADR 0029, the ADR
 * 0012 consumer-owned-port idiom): delegates straight to {@link ContextSnapshotAssembler#render},
 * the same rendering every other context-snapshot consumer gets. Gated on {@code COMPANION_SWITCH}
 * alone — {@code DecisionService}'s own {@code JOURNAL_SWITCH} gate already covers the journal
 * side — so with the companion off there is no adapter bean and {@code DecisionService}'s {@code
 * ObjectProvider<DecisionContextPort>} degrades to an EMPTY snapshot text (never fabricated, never
 * a failed decision write, IDENT-3).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DecisionContextAssemblerAdapter implements DecisionContextPort {

    private final ContextSnapshotAssembler contextSnapshotAssembler;

    @Override
    public String render(UUID userId, LocalDate today) {
        return contextSnapshotAssembler.render(userId, today);
    }
}
