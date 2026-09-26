package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectLinkRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonFactRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveMemoryBlock;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S5 (bd mezo-d6ivw.5) Task 3: the proactive apropó matcher — same-day/planned-workout/yesterday
 * trigger matching against {@code EffectLinkService.gatedEffects}, the 3-day cooldown ledger, and
 * the exact hedged block rendering the model receives.
 *
 * <p>Every date anchors to {@link #DATE} (never {@code LocalDate.now()}/{@code Instant.now()}) so
 * a run after midnight can never fall out of a "today"/"yesterday" boundary.
 */
@ActiveProfiles("companion-fake")
class ProactiveMemoryBlockIT extends AbstractIntegrationTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 6);

    @Autowired private ProactiveMemoryBlock proactiveMemoryBlock;
    @Autowired private EffectLinkRepository effectLinkRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private PersonFactRepository personFactRepository;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    private static Instant at(LocalDate day, int hour) {
        return day.atStartOfDay(ZoneId.systemDefault()).plusHours(hour).toInstant();
    }

    private EffectLinkEntity effectRow(UUID owner, String kind, String key, String metric,
            double delta, int subjectDays, String band, String tier) {
        EffectLinkEntity e = new EffectLinkEntity();
        e.setCreatedBy(owner);
        e.setSubjectKind(kind);
        e.setSubjectKey(key);
        e.setMetric(metric);
        e.setCliffsDelta(BigDecimal.valueOf(delta).setScale(3));
        e.setMeanDiff(new BigDecimal("1.50"));
        e.setSubjectDays(subjectDays);
        e.setComplementDays(20);
        e.setStrengthBand(band);
        e.setConfidenceTier(tier);
        e.setWindowDays(60);
        e.setComputedAt(Instant.now());
        return effectLinkRepository.saveAndFlush(e);
    }

    private void contextMention(UUID owner, UUID personId, Instant ts, String contextLabel) {
        var m = new io.mrkuhne.mezo.feature.people.entity.MentionEntity();
        m.setCreatedBy(owner);
        m.setPersonId(personId);
        m.setTs(ts);
        m.setSource("chip");
        m.setExcerpt("Teszt említés.");
        m.setContextLabel(contextLabel);
        m.setFlagged(false);
        mentionRepository.saveAndFlush(m);
    }

    private void personMention(UUID owner, UUID personId, Instant ts) {
        var m = new io.mrkuhne.mezo.feature.people.entity.MentionEntity();
        m.setCreatedBy(owner);
        m.setPersonId(personId);
        m.setTs(ts);
        m.setSource("chip");
        m.setExcerpt("Teszt említés.");
        m.setFlagged(false);
        mentionRepository.saveAndFlush(m);
    }

    private PersonFactEntity personFact(UUID owner, UUID personId, String kind, String text) {
        PersonFactEntity f = new PersonFactEntity();
        f.setCreatedBy(owner);
        f.setPersonId(personId);
        f.setKind(kind);
        f.setFactText(text);
        f.setConfidence("medium");
        f.setSourceRefKind("chat_turn");
        f.setSourceRefId(UUID.randomUUID().toString());
        f.setActive(true);
        f.setIncludeInPrompt(true);
        return personFactRepository.saveAndFlush(f);
    }

    @Test
    void sameDayContextMatchFiresEveningApropo() {
        UUID owner = userPopulator.createUser().getId();
        contextMention(owner, personPopulator.createPerson(owner, "Anna").getId(), at(DATE, 9), "kozos_program");
        effectRow(owner, EffectLinkEntity.SUBJECT_EVENT, "kozos_program", EffectLinkEntity.METRIC_STRESS,
                0.7, 8, "eros", "kozepes");

        Optional<ProactiveMemoryBlock.Apropo> result =
                proactiveMemoryBlock.apropo(owner, DATE, CompanionMessageEntity.KIND_EVENING);

        assertThat(result).isPresent();
        String block = result.get().block();
        assertThat(block).contains("AKTUÁLIS APROPÓ").contains("magasabb").contains("előre néző");
        assertThat(result.get().topicKey()).isEqualTo(
                io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkService.topicKey(
                        EffectLinkEntity.SUBJECT_EVENT, "kozos_program", EffectLinkEntity.METRIC_STRESS));
        assertThat(result.get().ref().kind()).isEqualTo("Effect");
    }

    @Test
    void yesterdayPersonMatchWithFactFiresMorningApropo() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity bela = personPopulator.createPerson(owner, "Béla");
        personMention(owner, bela.getId(), at(DATE.minusDays(1), 18));
        effectRow(owner, EffectLinkEntity.SUBJECT_PERSON, bela.getId().toString(), EffectLinkEntity.METRIC_MENTAL,
                -0.7, 8, "eros", "kozepes");
        personFact(owner, bela.getId(), PersonFactEntity.KIND_SENSITIVITY, "Nehéz időszakon megy át.");

        Optional<ProactiveMemoryBlock.Apropo> result =
                proactiveMemoryBlock.apropo(owner, DATE, CompanionMessageEntity.KIND_MORNING);

        assertThat(result).isPresent();
        String block = result.get().block();
        assertThat(block).contains("Tegnap").contains("visszakérdező").contains("alacsonyabb")
                .contains("Nehéz időszakon megy át.")
                .contains("Az érzékeny témát tapintatosan, kérdező formában hozd szóba, sose kijelentve.");
    }

    @Test
    void cooldownSuppressesForThreeDaysThenAllowsAgain() {
        UUID owner = userPopulator.createUser().getId();
        contextMention(owner, personPopulator.createPerson(owner, "Anna").getId(), at(DATE, 9), "kozos_program");
        effectRow(owner, EffectLinkEntity.SUBJECT_EVENT, "kozos_program", EffectLinkEntity.METRIC_STRESS,
                0.7, 8, "eros", "kozepes");

        Optional<ProactiveMemoryBlock.Apropo> first =
                proactiveMemoryBlock.apropo(owner, DATE, CompanionMessageEntity.KIND_EVENING);
        assertThat(first).isPresent();
        proactiveMemoryBlock.recordUse(owner, DATE, CompanionMessageEntity.KIND_EVENING, first.get());

        // Re-seed the same trigger for the following days (context mention day matters for the match).
        for (int i = 0; i <= 3; i++) {
            contextMention(owner, personPopulator.createPerson(owner, "Anna" + i).getId(),
                    at(DATE.plusDays(i), 9), "kozos_program");
        }

        assertThat(proactiveMemoryBlock.apropo(owner, DATE, CompanionMessageEntity.KIND_EVENING)).isEmpty();
        assertThat(proactiveMemoryBlock.apropo(owner, DATE.plusDays(1), CompanionMessageEntity.KIND_EVENING))
                .isEmpty();
        assertThat(proactiveMemoryBlock.apropo(owner, DATE.plusDays(2), CompanionMessageEntity.KIND_EVENING))
                .isEmpty();
        assertThat(proactiveMemoryBlock.apropo(owner, DATE.plusDays(3), CompanionMessageEntity.KIND_EVENING))
                .isPresent();
    }

    @Test
    void nothingMatchesReturnsEmpty() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(proactiveMemoryBlock.apropo(owner, DATE, CompanionMessageEntity.KIND_EVENING)).isEmpty();
    }

    @Test
    void weakRowOnlyReturnsEmpty() {
        UUID owner = userPopulator.createUser().getId();
        contextMention(owner, personPopulator.createPerson(owner, "Anna").getId(), at(DATE, 9), "kozos_program");
        // weak on strength: never clears EffectLinkService's double gate
        effectRow(owner, EffectLinkEntity.SUBJECT_EVENT, "kozos_program", EffectLinkEntity.METRIC_STRESS,
                0.2, 8, "enyhe", "gyenge");

        assertThat(proactiveMemoryBlock.apropo(owner, DATE, CompanionMessageEntity.KIND_EVENING)).isEmpty();
    }

    @Test
    void plannedWorkoutOutranksYesterdayMatch() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        String dayLabel = io.mrkuhne.mezo.feature.train.service.WorkoutService.HU_DAY_LABELS
                .get(DATE.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), dayLabel);
        // planned workout today (edzes) AND a yesterday person match — planned must win.
        effectRow(owner, EffectLinkEntity.SUBJECT_EVENT, "edzes", EffectLinkEntity.METRIC_ENERGY,
                0.6, 8, "eros", "kozepes");
        PersonEntity cili = personPopulator.createPerson(owner, "Cili");
        personMention(owner, cili.getId(), at(DATE.minusDays(1), 18));
        effectRow(owner, EffectLinkEntity.SUBJECT_PERSON, cili.getId().toString(), EffectLinkEntity.METRIC_MENTAL,
                0.9, 8, "eros", "kozepes");

        Optional<ProactiveMemoryBlock.Apropo> result =
                proactiveMemoryBlock.apropo(owner, DATE, CompanionMessageEntity.KIND_MORNING);

        assertThat(result).isPresent();
        assertThat(result.get().block()).contains("Ma (terv szerint)").doesNotContain("Tegnap");
        assertThat(template).isNotNull();
    }
}
