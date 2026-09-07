package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.QuickNoticePreScreen;
import io.mrkuhne.mezo.feature.companion.reflection.service.QuickNoticePreScreen.Kind;
import io.mrkuhne.mezo.feature.companion.reflection.service.QuickNoticePreScreen.Trigger;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Reflexió S4 (mezo-eq85.4) Step 1: {@link QuickNoticePreScreen} is a PURE function — no Spring,
 * no repository, no LLM — every input arrives as a method argument. Rules are evaluated in a
 * fixed order and the first hit wins (the {@code HypothesisLifecycle} precedent).
 */
class QuickNoticePreScreenTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 7);

    private final QuickNoticePreScreen preScreen = new QuickNoticePreScreen();

    @Test
    void touchesOpen_whenPersonOfAnOpenPlanAppears() {
        PatternEntity open = pattern("people:anna", "sleep-duration-h");
        TextSignalEntity signal = signal(TODAY, List.of("Anna"), List.of(), null, null);

        Optional<Trigger> result = preScreen.screen(signal, List.of(open), List.of());

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(Kind.TOUCHES_OPEN);
        assertThat(result.get().patternIds()).containsExactly(open.getId());
    }

    @Test
    void newPerson_onThirdMentionWithinSevenDays() {
        List<TextSignalEntity> lastSevenDays = List.of(
                signal(TODAY.minusDays(4), List.of("Anna"), List.of(), null, null),
                signal(TODAY.minusDays(2), List.of("Anna"), List.of(), null, null));
        TextSignalEntity current = signal(TODAY, List.of("Anna"), List.of(), null, null);

        Optional<Trigger> result = preScreen.screen(current, List.of(), lastSevenDays);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(Kind.NEW_PERSON);
        assertThat(result.get().person()).isEqualTo("Anna");
    }

    @Test
    void extremeMood_onlyWhenSure() {
        TextSignalEntity sure = signal(TODAY, List.of(), List.of(), 5, TextSignalEntity.CONFIDENCE_SURE);
        TextSignalEntity unsure = signal(TODAY, List.of(), List.of(), 5, TextSignalEntity.CONFIDENCE_UNSURE);

        Optional<Trigger> sureResult = preScreen.screen(sure, List.of(), List.of());
        assertThat(sureResult).isPresent();
        assertThat(sureResult.get().kind()).isEqualTo(Kind.EXTREME_MOOD);

        assertThat(preScreen.screen(unsure, List.of(), List.of())).isEmpty();
    }

    @Test
    void topicStreak_onFourConsecutiveDays() {
        List<TextSignalEntity> lastSevenDays = List.of(
                signal(TODAY.minusDays(3), List.of(), List.of("munka"), null, null),
                signal(TODAY.minusDays(2), List.of(), List.of("munka"), null, null),
                signal(TODAY.minusDays(1), List.of(), List.of("munka"), null, null));
        TextSignalEntity current = signal(TODAY, List.of(), List.of("munka"), null, null);

        Optional<Trigger> result = preScreen.screen(current, List.of(), lastSevenDays);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(Kind.TOPIC_STREAK);
        assertThat(result.get().topic()).isEqualTo("munka");
    }

    /**
     * Rule priority (brief order: TOUCHES_OPEN, NEW_PERSON, EXTREME_MOOD, TOPIC_STREAK; first
     * hit wins). Each test below builds a signal/state pair where two adjacent rules would BOTH
     * fire and pins that the earlier-ranked {@link Kind} is the one returned — so a future
     * reorder of the {@code if} chain in {@link QuickNoticePreScreen#screen} fails a test instead
     * of silently changing behaviour.
     */
    @Test
    void priority_touchesOpenBeatsNewPerson() {
        PatternEntity open = pattern("people:anna", "sleep-duration-h");
        List<TextSignalEntity> lastSevenDays = List.of(
                signal(TODAY.minusDays(4), List.of("Anna"), List.of(), null, null),
                signal(TODAY.minusDays(2), List.of("Anna"), List.of(), null, null));
        TextSignalEntity current = signal(TODAY, List.of("Anna"), List.of(), null, null);

        Optional<Trigger> result = preScreen.screen(current, List.of(open), lastSevenDays);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(Kind.TOUCHES_OPEN);
    }

    @Test
    void priority_newPersonBeatsExtremeMood() {
        List<TextSignalEntity> lastSevenDays = List.of(
                signal(TODAY.minusDays(4), List.of("Anna"), List.of(), null, null),
                signal(TODAY.minusDays(2), List.of("Anna"), List.of(), null, null));
        TextSignalEntity current =
                signal(TODAY, List.of("Anna"), List.of(), 5, TextSignalEntity.CONFIDENCE_SURE);

        Optional<Trigger> result = preScreen.screen(current, List.of(), lastSevenDays);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(Kind.NEW_PERSON);
    }

    @Test
    void priority_extremeMoodBeatsTopicStreak() {
        List<TextSignalEntity> lastSevenDays = List.of(
                signal(TODAY.minusDays(3), List.of(), List.of("munka"), null, null),
                signal(TODAY.minusDays(2), List.of(), List.of("munka"), null, null),
                signal(TODAY.minusDays(1), List.of(), List.of("munka"), null, null));
        TextSignalEntity current =
                signal(TODAY, List.of(), List.of("munka"), 5, TextSignalEntity.CONFIDENCE_SURE);

        Optional<Trigger> result = preScreen.screen(current, List.of(), lastSevenDays);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(Kind.EXTREME_MOOD);
    }

    @Test
    void empty_whenNothingSalient() {
        TextSignalEntity current = signal(TODAY, List.of(), List.of(), 3, TextSignalEntity.CONFIDENCE_SURE);

        assertThat(preScreen.screen(current, List.of(), List.of())).isEmpty();
    }

    private PatternEntity pattern(String seriesA, String seriesB) {
        PatternEntity pattern = new PatternEntity();
        pattern.setId(UUID.randomUUID());
        pattern.setTestPlan(new TestPlanEnvelope(
                seriesA, seriesB, 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60));
        return pattern;
    }

    private TextSignalEntity signal(
            LocalDate day, List<String> people, List<String> topics, Integer mood, String confidence) {
        TextSignalEntity signal = new TextSignalEntity();
        signal.setOccurredOn(day);
        signal.setPeople(people);
        signal.setTopics(topics);
        signal.setMood(mood);
        signal.setConfidence(confidence == null ? TextSignalEntity.CONFIDENCE_SURE : confidence);
        return signal;
    }
}
