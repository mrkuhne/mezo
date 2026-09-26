package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectLinkRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkService;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * S4 (mezo-d6ivw.4) Task 5: the nightly named-effect recompute and its two read paths — the
 * hypothesis-prompt block and the per-person read with the serve-time confidence bump.
 *
 * <p>Midnight-anchored: every date derives from the ONE {@code today} handed to
 * {@link EffectLinkService#recompute}; mentions sit at local noon of their day, check-ins on
 * explicit days inside {@code [today-60, today-1]}.
 */
@ActiveProfiles("companion-fake")
class EffectLinkServiceIT extends AbstractIntegrationTest {

    @Autowired private EffectLinkService effectLinkService;
    @Autowired private EffectLinkRepository effectLinkRepository;
    @Autowired private CheckInRepository checkInRepository;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private final LocalDate today = LocalDate.now();

    private static Instant noon(LocalDate day) {
        return day.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant();
    }

    /** Days {@code today-first .. today-(first+count-1)}. */
    private List<LocalDate> days(int first, int count) {
        List<LocalDate> out = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            out.add(today.minusDays(first + i));
        }
        return out;
    }

    private List<CheckInEntity> checkIns(UUID owner, List<LocalDate> days, int energy, int stress, int mental) {
        return days.stream()
                .map(d -> checkInPopulator.createCheckIn(owner, d, "08:00", energy, stress, 3, mental, null))
                .toList();
    }

    private void mentions(UUID owner, UUID personId, List<LocalDate> days) {
        days.forEach(d -> mentionPopulator.createMention(owner, personId, noon(d), "neutral"));
    }

    private EffectLinkEntity row(UUID owner, String kind, String key, String metric, double delta,
                                 int subjectDays, String band, String tier) {
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

    private List<EffectLinkEntity> personRows(UUID owner, UUID personId) {
        return effectLinkRepository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(
                owner, EffectLinkEntity.SUBJECT_PERSON, personId.toString());
    }

    @Test
    void personEffectRowUpsertedAndUpdated() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        List<LocalDate> mentionDays = days(1, 6);
        mentions(owner, anna.getId(), mentionDays);
        List<CheckInEntity> onDays = checkIns(owner, mentionDays, 3, 3, 8);
        checkIns(owner, days(7, 12), 3, 3, 5);

        effectLinkService.recompute(owner, today);

        List<EffectLinkEntity> rows = personRows(owner, anna.getId());
        assertThat(rows).hasSize(1);
        EffectLinkEntity first = rows.getFirst();
        assertThat(first.getMetric()).isEqualTo(EffectLinkEntity.METRIC_MENTAL);
        assertThat(first.getStrengthBand()).isEqualTo("eros");
        assertThat(first.getConfidenceTier()).isEqualTo("gyenge");
        assertThat(first.getCliffsDelta()).isPositive();
        assertThat(first.getWindowDays()).isEqualTo(60);

        onDays.forEach(c -> {
            c.setMental(2);
            checkInRepository.saveAndFlush(c);
        });
        effectLinkService.recompute(owner, today);

        List<EffectLinkEntity> after = personRows(owner, anna.getId());
        assertThat(after).hasSize(1);
        assertThat(after.getFirst().getId()).isEqualTo(first.getId());
        assertThat(after.getFirst().getCliffsDelta()).isNegative();
    }

    @Test
    void belowGateRowIsDeleted() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        EffectLinkEntity stale = row(owner, EffectLinkEntity.SUBJECT_PERSON, anna.getId().toString(),
                EffectLinkEntity.METRIC_MENTAL, 0.9, 6, "eros", "gyenge");
        List<LocalDate> mentionDays = days(1, 3);
        mentions(owner, anna.getId(), mentionDays);
        checkIns(owner, mentionDays, 3, 3, 8);
        checkIns(owner, days(4, 12), 3, 3, 5);

        effectLinkService.recompute(owner, today);

        assertThat(personRows(owner, anna.getId())).isEmpty();
        Boolean deleted = jdbcTemplate.queryForObject(
                "select is_deleted from effect_link where id = ?", Boolean.class, stale.getId());
        assertThat(deleted).isTrue();
    }

    @Test
    void eventTypeEdzesRow() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Push");
        List<LocalDate> workoutDays = days(1, 5);
        workoutDays.forEach(d -> trainPopulator.createWorkoutInstance(owner, template, d, "completed"));
        checkIns(owner, workoutDays, 8, 3, 5);
        checkIns(owner, days(6, 12), 4, 3, 5);

        effectLinkService.recompute(owner, today);

        List<EffectLinkEntity> rows = effectLinkRepository
                .findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(
                        owner, EffectLinkEntity.SUBJECT_EVENT, "edzes");
        assertThat(rows).extracting(EffectLinkEntity::getMetric)
                .containsExactly(EffectLinkEntity.METRIC_ENERGY);
    }

    @Test
    void promptBlockOnlyDoubleGatedRows() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        PersonEntity bela = personPopulator.createPerson(owner, "Béla");
        PersonEntity cili = personPopulator.createPerson(owner, "Cili");
        List<LocalDate> mentionDays = days(1, 16);
        mentions(owner, anna.getId(), mentionDays);
        checkIns(owner, mentionDays, 3, 3, 8);
        checkIns(owner, days(17, 12), 3, 3, 5);
        effectLinkService.recompute(owner, today);
        // weak on both axes, and strong-but-unsure: neither clears the double gate
        row(owner, EffectLinkEntity.SUBJECT_PERSON, bela.getId().toString(),
                EffectLinkEntity.METRIC_ENERGY, 0.2, 5, "enyhe", "gyenge");
        row(owner, EffectLinkEntity.SUBJECT_PERSON, cili.getId().toString(),
                EffectLinkEntity.METRIC_STRESS, 0.9, 5, "eros", "gyenge");

        String block = effectLinkService.promptBlock(owner);

        String annaKey = "effect-person-" + anna.getId().toString().replace("-", "").substring(0, 8)
                + "-mental";
        assertThat(block).startsWith("NEVESÍTETT EGYÜTTJÁRÁSOK");
        assertThat(block).contains(annaKey).contains("Anna");
        assertThat(block).doesNotContain("Béla").doesNotContain("Cili");
        assertThat(block.lines().filter(l -> l.startsWith("- "))).hasSize(1);
        assertThat(EffectLinkService.topicKey(EffectLinkEntity.SUBJECT_PERSON, anna.getId().toString(),
                EffectLinkEntity.METRIC_MENTAL)).isEqualTo(annaKey);
    }

    @Test
    void confidenceBumpFromConfirmedObservation() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        EffectLinkEntity stored = row(owner, EffectLinkEntity.SUBJECT_PERSON, anna.getId().toString(),
                EffectLinkEntity.METRIC_MENTAL, 0.6, 10, "eros", "kozepes");
        PatternEntity confirmed = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        confirmed.setEvidence(new PatternEvidenceEnvelope(List.of("observation-topic-key:"
                + EffectLinkService.topicKey(EffectLinkEntity.SUBJECT_PERSON, anna.getId().toString(),
                        EffectLinkEntity.METRIC_MENTAL))));
        patternPopulator.save(confirmed);

        List<EffectLinkEntity> served = effectLinkService.effectsForPerson(owner, anna.getId());

        assertThat(served).singleElement()
                .extracting(EffectLinkEntity::getConfidenceTier).isEqualTo("eros");
        assertThat(effectLinkRepository.findById(stored.getId()).orElseThrow().getConfidenceTier())
                .isEqualTo("kozepes");
    }

    @Test
    void stressPolarityIsNotFlippedInStorage() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        List<LocalDate> mentionDays = days(1, 6);
        mentions(owner, anna.getId(), mentionDays);
        checkIns(owner, mentionDays, 3, 8, 5);
        checkIns(owner, days(7, 12), 3, 3, 5);

        effectLinkService.recompute(owner, today);

        assertThat(personRows(owner, anna.getId())).singleElement().satisfies(r -> {
            assertThat(r.getMetric()).isEqualTo(EffectLinkEntity.METRIC_STRESS);
            assertThat(r.getCliffsDelta()).isPositive();
            assertThat(r.getMeanDiff()).isPositive();
        });
    }
}
