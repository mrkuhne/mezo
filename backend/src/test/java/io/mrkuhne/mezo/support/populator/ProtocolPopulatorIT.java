package io.mrkuhne.mezo.support.populator;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Integration tests for {@link ProtocolPopulator} — verifies the backdating seam
 * ({@code createProtocolItemAt}) works correctly for protocol_lapse detection tests.
 */
class ProtocolPopulatorIT extends AbstractIntegrationTest {

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private PantryItemPopulator pantryItemPopulator;

    @Autowired
    private ProtocolPopulator protocolPopulator;

    @Test
    void backdated_protocol_item_keeps_its_created_at() {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, "Magnézium").getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        Instant thirtyDaysAgo = LocalDate.now().minusDays(30)
            .atStartOfDay(ZoneId.systemDefault()).toInstant();

        ProtocolItemEntity item = protocolPopulator.createProtocolItemAt(
            owner, protocolId, pantry, "breakfast", null, thirtyDaysAgo);

        assertThat(item.getCreatedAt()).isEqualTo(thirtyDaysAgo);
    }
}
