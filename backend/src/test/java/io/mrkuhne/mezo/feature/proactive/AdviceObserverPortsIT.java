package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.AdviceRankPort;
import io.mrkuhne.mezo.feature.companion.flags.service.DailyCardPort;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The two seams the observer reads proactive through (spec 2026-09-05 §5). They exist so
 * companion.flags never imports feature.proactive — see the ports' own javadoc.
 */
class AdviceObserverPortsIT extends AbstractIntegrationTest {

    @Autowired
    private AdviceRankPort rankPort;
    @Autowired
    private DailyCardPort cardPort;
    @Autowired
    private CompanionMessageRepository companionMessageRepository;
    @Autowired
    private UserPopulator userPopulator;

    @Test
    void rank_port_orders_by_the_editorial_severity_table() {
        assertThat(rankPort.rankOf(FlagKey.ACUTE_BAD_DAY))
            .isLessThan(rankPort.rankOf(FlagKey.LATE_EATING));
        assertThat(rankPort.rankOf(FlagKey.LATE_EATING))
            .isLessThan(rankPort.rankOf(FlagKey.ALL_HEALTHY));
    }

    @Test
    void card_port_returns_the_days_advice_card_with_its_key() {
        UUID userId = userPopulator.createUser().getId();
        LocalDate day = LocalDate.of(2026, 9, 4);
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(day);
        row.setKind(CompanionMessageEntity.KIND_ADVICE);
        row.setContent(CompanionMessageEnvelope.advice("Alvás", "Aludj többet.",
            FlagKey.SLEEP_DEBT, null, null, List.of(), List.of()));
        row.setGeneratedAt(Instant.now());
        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(row);

        assertThat(cardPort.forDay(userId, day))
            .contains(new DailyCardPort.DeliveredCard(
                saved.getId(), FlagKey.SLEEP_DEBT, saved.getCreatedAt()));
    }

    @Test
    void card_port_is_empty_on_a_day_with_no_card() {
        assertThat(cardPort.forDay(userPopulator.createUser().getId(), LocalDate.of(2026, 9, 4)))
            .isEmpty();
    }
}
