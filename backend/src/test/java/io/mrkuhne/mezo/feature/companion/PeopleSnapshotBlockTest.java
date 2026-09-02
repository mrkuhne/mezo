package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.service.PeopleSnapshotBlock;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonChatContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;

/**
 * mezo-x6oa: az [Emberek] blokk renderelése — formátum, cap, becsületes hiány, IDENT-3. Tiszta
 * unit (Mockito): a PEOPLE_SWITCH-off (bean hiányzik) és a forrás-hiba ág itt determinisztikus.
 */
class PeopleSnapshotBlockTest {

    private static final UUID USER = UUID.randomUUID();
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 2);

    @SuppressWarnings("unchecked")
    private final ObjectProvider<PeopleService> provider = mock(ObjectProvider.class);
    private final PeopleService peopleService = mock(PeopleService.class);
    private final CompanionProperties properties = mock(CompanionProperties.class);
    private PeopleSnapshotBlock block;

    @BeforeEach
    void setUp() {
        when(provider.getIfAvailable()).thenReturn(peopleService);
        withMax(12);
        block = new PeopleSnapshotBlock(provider, properties);
    }

    private void withMax(int max) {
        when(properties.snapshot()).thenReturn(new CompanionProperties.Snapshot(7, 200, 180, max));
    }

    private static PersonChatContext row(String name, String rel, int week, String dir, String reason) {
        return new PersonChatContext(name, rel, week, week > 0 ? Instant.parse("2026-09-01T10:00:00Z") : null, dir, reason);
    }

    @Test
    void testRender_shouldRenderHeaderAndOneLinePerPerson_inTheSpecFormat() {
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Bence", "barát", 3, "down", "többször nehéz tónus, mint korábban"),
            row("Réka", "partner", 1, "flat", "kiegyensúlyozott hetek"),
            row("Ádám", "mentorált", 0, "flat", "még kevés hét az irányhoz"),
            row("Dóra", "kolléga", 2, "up", "jobb hetek, mint korábban")));

        String out = block.render(USER, TODAY);

        assertThat(out).isEqualTo("""
            [Emberek] (aktív kör, utolsó említés szerint, max 12)
            Bence — barát · 3× e héten · lefelé (többször nehéz tónus, mint korábban)
            Réka — partner · 1× e héten · kiegyensúlyozott hetek
            Ádám — mentorált · e héten nem került szóba · még kevés hét az irányhoz
            Dóra — kolléga · 2× e héten · felfelé (jobb hetek, mint korábban)""");
    }

    @Test
    void testRender_shouldFallBackToPlainDirectionWord_whenReasonIsNull() {
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Anna", "barát", 0, "flat", null),
            row("Bea", "barát", 1, "up", null),
            row("Cili", "barát", 1, "down", null)));

        String out = block.render(USER, TODAY);

        assertThat(out)
            .contains("Anna — barát · e héten nem került szóba · kiegyensúlyozott")
            .contains("Bea — barát · 1× e héten · felfelé")
            .contains("Cili — barát · 1× e héten · lefelé");
        assertThat(out.lines().skip(1)).noneMatch(l -> l.contains("("));
    }

    @Test
    void testRender_shouldCapAtPeopleMaxPersons_keepingSourceOrder() {
        withMax(2);
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Első", "barát", 3, "flat", "kiegyensúlyozott hetek"),
            row("Második", "barát", 2, "flat", "kiegyensúlyozott hetek"),
            row("Harmadik", "barát", 1, "flat", "kiegyensúlyozott hetek")));

        String out = block.render(USER, TODAY);

        assertThat(out).startsWith("[Emberek] (aktív kör, utolsó említés szerint, max 2)\n")
            .contains("Első —").contains("Második —").doesNotContain("Harmadik");
        assertThat(out.lines().count()).isEqualTo(3);
    }

    @Test
    void testRender_shouldRenderNincsAdat_whenNoActivePerson() {
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of());

        assertThat(block.render(USER, TODAY)).isEqualTo("[Emberek] nincs adat");
    }

    @Test
    void testRender_shouldRenderNincsAdat_whenPeopleBeanIsAbsent() {
        when(provider.getIfAvailable()).thenReturn(null);

        assertThat(block.render(USER, TODAY)).isEqualTo("[Emberek] nincs adat");
    }

    @Test
    void testRender_shouldRenderNincsAdat_whenSourceThrows() {
        when(peopleService.chatContext(eq(USER), any()))
            .thenThrow(new DataAccessResourceFailureException("boom"));

        assertThat(block.render(USER, TODAY)).isEqualTo("[Emberek] nincs adat");
    }

    @Test
    void testRender_shouldReturnEmptyString_whenMaxIsZero() {
        withMax(0);
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Bence", "barát", 3, "down", "többször nehéz tónus, mint korábban")));

        assertThat(block.render(USER, TODAY)).isEmpty();
    }
}
