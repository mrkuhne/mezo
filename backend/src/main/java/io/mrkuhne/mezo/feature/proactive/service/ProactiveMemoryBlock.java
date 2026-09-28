package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkService;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionContextSignal;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.MentionSignal;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.ProactiveMemoryUseEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ProactiveMemoryUseRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Emlékezet S5 (bd mezo-d6ivw.5): the proactive "apropó" matcher — code picks at most ONE named
 * effect ({@link EffectLinkService#gatedEffects}) whose subject happened today (or is planned for
 * today, or happened yesterday), and hands the model a small, hedged, non-causal block to weave
 * in IF it fits naturally. The model never invents the apropó; code selects it.
 *
 * <p>NOT switch-gated itself — its gated collaborators arrive via {@link ObjectProvider}: an
 * absent {@link EffectLinkService} (companion+reflection off) means no apropó can ever fire, an
 * absent {@link PersonFactService} (people off) just means a person trigger carries no fact
 * extras. {@link #apropo} NEVER throws: any failure is logged and treated as "nothing fires",
 * which is also the normal, honest case on most days.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProactiveMemoryBlock {

    static final int COOLDOWN_DAYS = 3;
    static final String REF_KIND = "Effect";

    /** The fixed event key the planned-workout trigger names — mirrors {@code EffectLinkService}'s
     *  own {@code EVENT_EDZES} taxonomy constant (package-private there, so re-declared here). */
    private static final String EVENT_EDZES = "edzes";

    /** Selection priority, low value wins — see {@link #apropo}'s Step 5. */
    private enum Trigger { SAME_DAY, PLANNED_WORKOUT, YESTERDAY }

    private final ObjectProvider<EffectLinkService> effectLinkService;
    private final ObjectProvider<PersonFactService> personFactService;
    private final MentionRepository mentionRepository;
    private final WorkoutService workoutService;
    private final ProactiveMemoryUseRepository useRepository;

    /** The rendered apropó block plus its cooldown key and the source ref for the message envelope. */
    public record Apropo(String block, String topicKey, CompanionMessageEnvelope.Ref ref) {}

    /**
     * The single, at-most-one apropó for this feed slot. Empty when nothing fires — the normal
     * case on most days. NEVER throws — any failure is logged and swallowed as absence.
     */
    public Optional<Apropo> apropo(UUID userId, LocalDate date, String kind) {
        try {
            if (!CompanionMessageEntity.KIND_MORNING.equals(kind)
                    && !CompanionMessageEntity.KIND_MIDDAY.equals(kind)
                    && !CompanionMessageEntity.KIND_EVENING.equals(kind)) {
                return Optional.empty();
            }
            EffectLinkService svc = effectLinkService.getIfAvailable();
            if (svc == null) {
                return Optional.empty();
            }
            Map<String, Trigger> candidates = candidateTriggers(userId, date, kind);
            if (candidates.isEmpty()) {
                return Optional.empty();
            }
            // COOLDOWN_DAYS full days of suppression starting on the use's own day: a use recorded
            // on d0 blocks d0..d0+COOLDOWN_DAYS-1 and frees up again exactly at d0+COOLDOWN_DAYS —
            // the >= cutoff for THAT query date must therefore sit one day past d0, i.e.
            // date-(COOLDOWN_DAYS-1), not date-COOLDOWN_DAYS (which would still catch d0 itself).
            Set<String> cooldownTopics = useRepository
                    .findByCreatedByAndUsedOnGreaterThanEqual(userId, date.minusDays(COOLDOWN_DAYS - 1)).stream()
                    .map(ProactiveMemoryUseEntity::getTopicKey)
                    .collect(Collectors.toSet());

            record Match(Trigger trigger, EffectLinkService.GatedEffect effect) {}
            List<Match> matches = new ArrayList<>();
            for (EffectLinkService.GatedEffect ge : svc.gatedEffects(userId)) {
                Trigger trigger = candidates.get(subjectKey(ge.subjectKind(), ge.subjectKey()));
                if (trigger != null && !cooldownTopics.contains(ge.topicKey())) {
                    matches.add(new Match(trigger, ge));
                }
            }
            if (matches.isEmpty()) {
                return Optional.empty();
            }
            matches.sort(Comparator.comparingInt(m -> priority(m.trigger())));
            Match chosen = matches.get(0);

            return Optional.of(render(userId, chosen.trigger(), chosen.effect()));
        } catch (Exception e) {
            log.warn("Proactive apropó match failed for user {} kind {} on {} — treating as absent",
                    userId, kind, date, e);
            return Optional.empty();
        }
    }

    /** Call AFTER the message row persisted. Fail-open (log-and-swallow) — a lost cooldown row
     *  only risks the same apropó firing again a bit sooner, never a crash. */
    @Transactional
    public void recordUse(UUID userId, LocalDate date, String kind, Apropo apropo) {
        try {
            ProactiveMemoryUseEntity use = new ProactiveMemoryUseEntity();
            use.setCreatedBy(userId);
            use.setUsedOn(date);
            use.setTopicKey(apropo.topicKey());
            use.setKind(kind);
            useRepository.save(use);
        } catch (Exception e) {
            log.warn("Failed to record proactive memory use for user {} kind {} topic {} — continuing",
                    userId, kind, apropo.topicKey(), e);
        }
    }

    // ---------------------------------------------------------------- candidate gathering

    /** Day-signal candidates keyed by {@code subjectKind:subjectKey}, each mapped to the ONE
     *  (highest-priority) trigger that reached it — see the class javadoc's priority order. */
    private Map<String, Trigger> candidateTriggers(UUID userId, LocalDate date, String kind) {
        Map<String, Trigger> out = new LinkedHashMap<>();
        if (CompanionMessageEntity.KIND_MIDDAY.equals(kind) || CompanionMessageEntity.KIND_EVENING.equals(kind)) {
            addDaySignals(out, userId, date, Trigger.SAME_DAY);
        } else if (CompanionMessageEntity.KIND_MORNING.equals(kind)) {
            if (workoutService.findPlannedTemplateForDateUnlessSkipped(userId, date).isPresent()) {
                out.putIfAbsent(subjectKey(EffectLinkEntity.SUBJECT_EVENT, EVENT_EDZES), Trigger.PLANNED_WORKOUT);
            }
            addDaySignals(out, userId, date.minusDays(1), Trigger.YESTERDAY);
        }
        return out;
    }

    /** Adds every mention-derived subject that happened on {@code day} — mapped exactly like
     *  {@code EffectLinkService.subjects}: context labels {@code edzes/munka/csalad} to their own
     *  event key, {@code kozos_program|baratok} to {@code kozos_program}, {@code konfliktus} to
     *  itself; every mentioned person id, regardless of context. {@code putIfAbsent} so an
     *  already-recorded higher-priority trigger for the same subject is never overwritten. */
    private void addDaySignals(Map<String, Trigger> out, UUID userId, LocalDate day, Trigger trigger) {
        for (MentionContextSignal signal : mentionRepository.findContextSignals(userId)) {
            if (day.equals(toDay(signal.ts()))) {
                String eventKey = eventKeyForContext(signal.contextLabel());
                if (eventKey != null) {
                    out.putIfAbsent(subjectKey(EffectLinkEntity.SUBJECT_EVENT, eventKey), trigger);
                }
            }
        }
        for (MentionSignal signal : mentionRepository.findSignals(userId)) {
            if (day.equals(toDay(signal.ts()))) {
                out.putIfAbsent(subjectKey(EffectLinkEntity.SUBJECT_PERSON, signal.personId().toString()), trigger);
            }
        }
    }

    private static String eventKeyForContext(String contextLabel) {
        if (contextLabel == null) {
            return null;
        }
        return switch (contextLabel) {
            case "edzes" -> "edzes";
            case "munka" -> "munka";
            case "csalad" -> "csalad";
            case "kozos_program", "baratok" -> "kozos_program";
            case "konfliktus" -> "konfliktus";
            default -> null;
        };
    }

    private static String subjectKey(String subjectKind, String subjectKey) {
        return subjectKind + ':' + subjectKey;
    }

    private static LocalDate toDay(Instant ts) {
        return ts.atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private static int priority(Trigger trigger) {
        return switch (trigger) {
            case SAME_DAY -> 0;
            case PLANNED_WORKOUT -> 1;
            case YESTERDAY -> 2;
        };
    }

    // ---------------------------------------------------------------- rendering

    private Apropo render(UUID userId, Trigger trigger, EffectLinkService.GatedEffect e) {
        String temporalWord = switch (trigger) {
            case SAME_DAY -> "Ma";
            case PLANNED_WORKOUT -> "Ma (terv szerint)";
            case YESTERDAY -> "Tegnap";
        };
        boolean forwardLooking = trigger != Trigger.YESTERDAY;

        StringBuilder b = new StringBuilder("\n\nAKTUÁLIS APROPÓ (kód választotta; együttjárás, nem ok-okozat):\n");
        b.append("- ").append(temporalWord).append(": ").append(e.subjectLabel())
         .append(" — az ilyen napokon a ").append(e.metricLabel()).append(" általában ")
         .append(e.higher() ? "magasabb" : "alacsonyabb")
         .append(" (").append(e.strengthBand()).append(" együttjárás, ").append(e.subjectDays()).append(" nap).\n");
        b.append("- Ha természetesen belefér, EGY gondoskodó, ")
         .append(forwardLooking ? "előre néző" : "visszakérdező")
         .append(" mondatban utalj rá — ha nem fér bele, hagyd ki teljesen.\n");
        b.append("- Óvatos, nem ok-okozati fogalmazás: \"általában\", \"hajlamos\" — soha \"mert\".\n");

        if (EffectLinkEntity.SUBJECT_PERSON.equals(e.subjectKind())) {
            appendPersonFacts(b, userId, e.subjectKey());
        }

        CompanionMessageEnvelope.Ref ref =
                new CompanionMessageEnvelope.Ref(REF_KIND, e.subjectLabel() + " · " + e.metricLabel());
        return new Apropo(b.toString(), e.topicKey(), ref);
    }

    /** ALL fact kinds — owner decision, no {@code PROACTIVE_EXCLUDED_KINDS} filter here — capped
     *  to the 3 newest ({@link PersonFactService#promptFacts} already returns newest-first). */
    private void appendPersonFacts(StringBuilder b, UUID userId, String personKey) {
        PersonFactService facts = personFactService.getIfAvailable();
        if (facts == null) {
            return;
        }
        UUID personId;
        try {
            personId = UUID.fromString(personKey);
        } catch (IllegalArgumentException ex) {
            return;
        }
        List<PersonFactEntity> newest = facts.promptFacts(userId, List.of(personId)).stream()
                .limit(3)
                .toList();
        if (newest.isEmpty()) {
            return;
        }
        b.append("SZEMÉLYES TÉNYEK ehhez az apropóhoz:\n");
        newest.forEach(f -> b.append("- ").append(f.getFactText()).append('\n'));
        b.append("- Az érzékeny témát tapintatosan, kérdező formában hozd szóba, sose kijelentve.\n");
    }
}
