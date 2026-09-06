package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/** mezo-iizd.10 — render, cap, degradációk (a PeopleSnapshotBlockTest mintája). */
class LifeGoalSnapshotBlockTest {

    private static final UUID USER = UUID.randomUUID();
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 5);

    @SuppressWarnings("unchecked")
    private LifeGoalSnapshotBlock block(LifeGoalSource source, int maxGoals) {
        ObjectProvider<LifeGoalSource> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(source);
        CompanionProperties properties = mock(CompanionProperties.class);
        when(properties.snapshot()).thenReturn(new CompanionProperties.Snapshot(7, 200, 180, 12, maxGoals));
        return new LifeGoalSnapshotBlock(provider, properties);
    }

    @Test
    void testRender_shouldRenderGoalsWeakestAndLivePlans_whenAllPresent() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenReturn(new LifeGoalSource.Summary(
            List.of(new LifeGoalSource.GoalLine("Kockahas", "health", "up", 2, 3)),
            "Alvás",
            List.of("ha 21:00 után képernyő, akkor olvasás")));

        String rendered = block(source, 3).render(USER, TODAY);

        assertThat(rendered)
            .startsWith("[Célok]")
            .contains("Kockahas [Egészség] · emelkedik · ma 2/3 pillér")
            .contains("Leggyengébb pillér: Alvás")
            .contains("Ma él: ha 21:00 után képernyő, akkor olvasás");
    }

    @Test
    void testRender_shouldCapGoalLines_whenMoreGoalsThanMax() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenReturn(new LifeGoalSource.Summary(
            List.of(new LifeGoalSource.GoalLine("A", "health", "flat", 0, 1),
                    new LifeGoalSource.GoalLine("B", "meaning", "flat", 0, 1)),
            null, List.of()));

        String rendered = block(source, 1).render(USER, TODAY);

        assertThat(rendered).contains("A [Egészség]").doesNotContain("B [Értelem]");
    }

    @Test
    void testRender_shouldReturnEmpty_whenConfiguredOff() {
        assertThat(block(mock(LifeGoalSource.class), 0).render(USER, TODAY)).isEmpty();
    }

    @Test
    void testRender_shouldSayNincsAdat_whenSourceBeanAbsent() {
        assertThat(block(null, 3).render(USER, TODAY)).isEqualTo("[Célok] nincs adat");
    }

    @Test
    void testRender_shouldSayNincsAktivEletcel_whenNoActiveGoals() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any()))
            .thenReturn(new LifeGoalSource.Summary(List.of(), null, List.of()));

        assertThat(block(source, 3).render(USER, TODAY)).isEqualTo("[Célok] nincs aktív életcél");
    }

    @Test
    void testRender_shouldDegradeToNincsAdat_whenSourceThrows() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenThrow(new IllegalStateException("boom"));

        assertThat(block(source, 3).render(USER, TODAY)).isEqualTo("[Célok] nincs adat");
    }

    @Test
    void testRender_shouldSanitizeEmbeddedNewlines_whenTitleContainsControlChars() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenReturn(new LifeGoalSource.Summary(
            List.of(new LifeGoalSource.GoalLine("Rossz\ncím", "health", "flat", 0, 1)),
            null, List.of()));

        assertThat(block(source, 3).render(USER, TODAY)).contains("Rossz cím").doesNotContain("Rossz\ncím");
    }
}
