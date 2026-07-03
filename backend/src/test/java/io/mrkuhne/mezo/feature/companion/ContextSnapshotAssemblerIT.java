package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0.3 context snapshot — deterministic, LLM-free (spec §4). The fake profile keeps the
 * Gemini adapter out of the context; the assembler itself never touches the port.
 */
@Transactional
@ActiveProfiles("companion-fake")
class ContextSnapshotAssemblerIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String block = assembler.render(owner, today);

        assertThat(block).startsWith("\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — " + today + "):");
        // all six blocks present, in spec §4 order
        int profil = block.indexOf("[Profil]");
        int cel = block.indexOf("[Cél]");
        int edzes = block.indexOf("[Edzés]");
        int fuel = block.indexOf("[Mai üzemanyag]");
        int med = block.indexOf("[Gyógyszer]");
        int rege = block.indexOf("[Regeneráció]");
        assertThat(profil).isPositive();
        assertThat(cel).isGreaterThan(profil);
        assertThat(edzes).isGreaterThan(cel);
        assertThat(fuel).isGreaterThan(edzes);
        assertThat(med).isGreaterThan(fuel);
        assertThat(rege).isGreaterThan(med);
        // absences are explicit, never invented (spec §4)
        assertThat(block)
            .contains("[Profil] nincs adat")
            .contains("[Cél] nincs adat")
            .contains("mezociklus: nincs adat")
            .contains("gym-rend: nincs adat")
            .contains("sport-rend: nincs adat")
            .contains("0 gym-edzés, 0 sportalkalom, 0 futás")
            .contains("protokoll: nincs adat, mai bevitel: 0")
            .contains("[Gyógyszer] nincs adat")
            .contains("alvás: nincs adat")
            .contains("check-in: nincs adat");
        // fuel targets come from config, so the fuel line renders numbers even on an empty day
        assertThat(block).contains("[Mai üzemanyag] 0/");
    }

    @Test
    void testRender_shouldBeDeterministic_whenCalledTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        assertThat(assembler.render(owner, today)).isEqualTo(assembler.render(owner, today));
    }
}
