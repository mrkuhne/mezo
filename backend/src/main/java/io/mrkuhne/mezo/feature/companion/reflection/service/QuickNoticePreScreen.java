package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Reflexió S4 (mezo-eq85.4) Step 1: decides whether an incoming {@link TextSignalEntity} is
 * salient enough to spend an LLM call — and maybe a daily observation slot — on. Deliberately a
 * PURE {@code @Component}: no repository, no LLM, every input arrives as a method argument, so
 * the whole decision tree is testable as arithmetic (the {@code HypothesisLifecycle} precedent).
 *
 * <p>Rules are evaluated in a fixed order and the FIRST hit wins. {@code TOUCHES_OPEN} only
 * matches an open plan's {@code people:}/{@code topic:} series in v1 — a plan keyed on a bare
 * {@code MetricKey} is caught by the nightly pass instead (spec 2026-09-06 §Task 4).
 */
@Component
public class QuickNoticePreScreen {

    private static final String PEOPLE_PREFIX = "people:";
    private static final String TOPIC_PREFIX = "topic:";
    private static final int EXTREME_MOOD_LOW = 1;
    private static final int EXTREME_MOOD_HIGH = 5;
    /** A person's THIRD mention (two prior + today) is what makes them "new" enough to notice. */
    private static final long NEW_PERSON_PRIOR_MENTIONS = 2;
    private static final int TOPIC_STREAK_PRIOR_DAYS = 3;

    public enum Kind { TOUCHES_OPEN, NEW_PERSON, EXTREME_MOOD, TOPIC_STREAK }

    public record Trigger(Kind kind, List<UUID> patternIds, String person, String topic) {}

    public Optional<Trigger> screen(
            TextSignalEntity signal, List<PatternEntity> open, List<TextSignalEntity> lastSevenDays) {
        Optional<Trigger> touchesOpen = touchesOpen(signal, open);
        if (touchesOpen.isPresent()) {
            return touchesOpen;
        }
        Optional<Trigger> newPerson = newPerson(signal, lastSevenDays);
        if (newPerson.isPresent()) {
            return newPerson;
        }
        Optional<Trigger> extremeMood = extremeMood(signal);
        if (extremeMood.isPresent()) {
            return extremeMood;
        }
        return topicStreak(signal, lastSevenDays);
    }

    private Optional<Trigger> touchesOpen(TextSignalEntity signal, List<PatternEntity> open) {
        List<UUID> matches = new ArrayList<>();
        String matchedPerson = null;
        String matchedTopic = null;
        for (PatternEntity pattern : open) {
            TestPlanEnvelope plan = pattern.getTestPlan();
            if (plan == null) {
                continue;
            }
            String person = prefixed(plan, PEOPLE_PREFIX);
            if (person != null && containsIgnoreCase(signal.getPeople(), person)) {
                matches.add(pattern.getId());
                matchedPerson = person;
                continue;
            }
            String topic = prefixed(plan, TOPIC_PREFIX);
            if (topic != null && containsIgnoreCase(signal.getTopics(), topic)) {
                matches.add(pattern.getId());
                matchedTopic = topic;
            }
        }
        if (matches.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new Trigger(Kind.TOUCHES_OPEN, matches, matchedPerson, matchedTopic));
    }

    private Optional<Trigger> newPerson(TextSignalEntity signal, List<TextSignalEntity> lastSevenDays) {
        for (String person : signal.getPeople()) {
            long priorMentions = lastSevenDays.stream()
                    .filter(s -> containsIgnoreCase(s.getPeople(), person))
                    .count();
            if (priorMentions == NEW_PERSON_PRIOR_MENTIONS) {
                return Optional.of(new Trigger(Kind.NEW_PERSON, List.of(), person, null));
            }
        }
        return Optional.empty();
    }

    private Optional<Trigger> extremeMood(TextSignalEntity signal) {
        Integer mood = signal.getMood();
        if (signal.isSure() && mood != null && (mood <= EXTREME_MOOD_LOW || mood >= EXTREME_MOOD_HIGH)) {
            return Optional.of(new Trigger(Kind.EXTREME_MOOD, List.of(), null, null));
        }
        return Optional.empty();
    }

    private Optional<Trigger> topicStreak(TextSignalEntity signal, List<TextSignalEntity> lastSevenDays) {
        for (String topic : signal.getTopics()) {
            boolean streak = true;
            for (int daysBack = 1; daysBack <= TOPIC_STREAK_PRIOR_DAYS; daysBack++) {
                LocalDate day = signal.getOccurredOn().minusDays(daysBack);
                boolean present = lastSevenDays.stream()
                        .anyMatch(s -> day.equals(s.getOccurredOn()) && containsIgnoreCase(s.getTopics(), topic));
                if (!present) {
                    streak = false;
                    break;
                }
            }
            if (streak) {
                return Optional.of(new Trigger(Kind.TOPIC_STREAK, List.of(), null, topic));
            }
        }
        return Optional.empty();
    }

    private String prefixed(TestPlanEnvelope plan, String prefix) {
        if (plan.seriesA() != null && plan.seriesA().toLowerCase(Locale.ROOT).startsWith(prefix)) {
            return plan.seriesA().substring(prefix.length());
        }
        if (plan.seriesB() != null && plan.seriesB().toLowerCase(Locale.ROOT).startsWith(prefix)) {
            return plan.seriesB().substring(prefix.length());
        }
        return null;
    }

    private boolean containsIgnoreCase(List<String> values, String target) {
        return values != null && values.stream().anyMatch(v -> v.equalsIgnoreCase(target));
    }
}
