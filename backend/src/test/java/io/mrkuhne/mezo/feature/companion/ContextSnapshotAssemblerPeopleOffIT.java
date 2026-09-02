package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-x6oa final-review (finding E): {@code ContextSnapshotAssembler.peopleLine}'s empty branch
 * ({@code snapshot.people-max-persons = 0} → {@code PeopleSnapshotBlock.render} returns {@code ""}
 * → the assembler must not leave a stray blank line where {@code [Emberek]} would have sat) had no
 * test at any level. Own IT class on purpose — the {@link TestPropertySource} override forks the
 * Spring context (the {@code ProfilePromptAssemblerFailureIT} precedent), so it must not share the
 * clean-context class with the rest of {@code ContextSnapshotAssemblerIT}.
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.snapshot.people-max-persons=0")
class ContextSnapshotAssemblerPeopleOffIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PersonPopulator personPopulator;

    @Test
    void testRender_shouldOmitEmberekBlock_andLeaveNoDoubledNewline_whenPeopleMaxPersonsIsZero() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        // an active person exists — the point is that the CONFIG (not an empty circle) is what
        // suppresses the block here.
        personPopulator.createPerson(owner, "Anna");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).doesNotContain("[Emberek]");
        int gyakorlat = snapshot.indexOf("[Napi gyakorlat]");
        int uzemanyag = snapshot.indexOf("[Mai üzemanyag]");
        assertThat(gyakorlat).isPositive();
        assertThat(uzemanyag).isGreaterThan(gyakorlat);
        // no doubled newline in the gap where the [Emberek] block would have sat between the two
        assertThat(snapshot.substring(gyakorlat, uzemanyag)).doesNotContain("\n\n\n").doesNotContain("\n\n");
    }
}
