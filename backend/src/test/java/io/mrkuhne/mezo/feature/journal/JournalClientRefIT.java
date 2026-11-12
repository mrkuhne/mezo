package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.feature.journal.service.JournalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Boop B3 (mezo-r36n9.13): idempotent journal create by clientRef; source {@code boop} accepted. */
class JournalClientRefIT extends AbstractIntegrationTest {

    @Autowired private JournalService service;
    @Autowired private UserPopulator userPopulator;

    private CreateJournalEntryRequest req(String text, UUID ref) {
        return new CreateJournalEntryRequest().text(text).source("boop")
            .occurredOn(LocalDate.now()).clientRef(ref);
    }

    @Test
    void repeatedJournalClientRefReturnsSameEntry() {
        UUID owner = userPopulator.createUser("journal-ref@test.hu").getId();
        UUID ref = UUID.randomUUID();
        var first = service.create(owner, req("Jó nap volt.", ref));
        var second = service.create(owner, req("Jó nap volt.", ref));
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(service.list(owner, LocalDate.now(), LocalDate.now())).hasSize(1);
        assertThat(service.findByClientRef(owner, ref)).isPresent();
    }

    @Test
    void acceptsBoopSource() {
        UUID owner = userPopulator.createUser("journal-boop@test.hu").getId();
        var saved = service.create(owner, req("Hangjegyzet.", null));
        assertThat(saved.getSource().getValue()).isEqualTo("boop");
    }
}
