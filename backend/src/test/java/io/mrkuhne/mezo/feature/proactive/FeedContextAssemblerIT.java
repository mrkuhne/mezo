package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.proactive.service.FeedContextAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.CompanionPreferencesPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.contextual-feed.enabled=true")
class FeedContextAssemblerIT extends AbstractIntegrationTest {
    @Autowired private FeedContextAssembler assembler;
    @Autowired private DatabasePopulator users;
    @Autowired private CompanionMessagePopulator messages;
    @Autowired private CompanionPreferencesPopulator preferences;

    @Test
    void testAssemble_shouldPrioritizeFreshEvidenceAndIncludePersonalContext_whenHistoryExists() {
        var user = users.populateUser("context-assemble@test.local");
        var today = LocalDate.of(2026, 9, 23);
        var now = Instant.parse("2026-09-23T10:00:00Z");
        preferences.preferences(user, "Szeretek röplabdázni.", "Legyél konkrét.", false);
        var prior = messages.createMessage(user, today.minusDays(1), "weight", "Előzmény",
                List.of("Megnézzük a következő mérést."), now.minusSeconds(86400));
        var result = assembler.assemble(user, today, now, "weight", "FRISS MÉRÉS: 80,2 kg");
        assertThat(result.text()).startsWith("FRISS MÉRÉS: 80,2 kg")
                .contains("Szeretek röplabdázni", "Legyél konkrét", "Megnézzük a következő mérést");
        assertThat(result.priorMessageIds()).contains(prior.getId());
        assertThat(result.text()).doesNotContain("MEGERŐSÍTETT TÉNYEK");
    }
}
