package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectLinkRepository;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ProactiveMemoryUseRepository;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S5 (bd mezo-d6ivw.5) Task 4: the legacy morning/window prompts wire {@link
 * io.mrkuhne.mezo.feature.proactive.service.ProactiveMemoryBlock}'s apropó — the block reaches
 * the prompt, the unconditional {@code Effect} ref lands on the persisted morning row (code
 * decides provenance, not the model), and a {@code proactive_memory_use} row is recorded after a
 * successful save.
 *
 * <p>NOT class-transactional and reflection is left ON (the default for {@code companion-fake}):
 * {@link io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkService} — the collaborator
 * {@code ProactiveMemoryBlock.apropo} needs — is itself gated behind the reflection switch, which
 * {@code CompanionMessageGeneratorIT} disables for its own unrelated reason (digest-read cost under
 * a class-wide transaction). Same idiom/rationale as {@code ReflectionDigestMorningIT}: the
 * no-apropó path stays covered there; this class covers the positive match.
 */
@ActiveProfiles("companion-fake")
class CompanionMessageGeneratorApropoIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private EffectLinkRepository effectLinkRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private ProactiveMemoryUseRepository proactiveMemoryUseRepository;

    /** Same idiom as {@code ProactiveMemoryBlockIT#effectRow}. */
    private EffectLinkEntity effectRow(UUID owner, String kind, String key, String metric, double delta) {
        EffectLinkEntity e = new EffectLinkEntity();
        e.setCreatedBy(owner);
        e.setSubjectKind(kind);
        e.setSubjectKey(key);
        e.setMetric(metric);
        e.setCliffsDelta(BigDecimal.valueOf(delta).setScale(3));
        e.setMeanDiff(new BigDecimal("1.50"));
        e.setSubjectDays(8);
        e.setComplementDays(20);
        e.setStrengthBand("eros");
        e.setConfidenceTier("kozepes");
        e.setWindowDays(60);
        e.setComputedAt(Instant.now());
        return effectLinkRepository.saveAndFlush(e);
    }

    /** Same idiom as {@code ProactiveMemoryBlockIT#contextMention}. */
    private void contextMention(UUID owner, UUID personId, Instant ts, String contextLabel) {
        MentionEntity m = new MentionEntity();
        m.setCreatedBy(owner);
        m.setPersonId(personId);
        m.setTs(ts);
        m.setSource("chip");
        m.setExcerpt("Teszt említés.");
        m.setContextLabel(contextLabel);
        m.setFlagged(false);
        mentionRepository.saveAndFlush(m);
    }

    /** Same idiom as {@code ProactiveMemoryBlockIT#personMention}. */
    private void personMention(UUID owner, UUID personId, Instant ts) {
        MentionEntity m = new MentionEntity();
        m.setCreatedBy(owner);
        m.setPersonId(personId);
        m.setTs(ts);
        m.setSource("chip");
        m.setExcerpt("Teszt említés.");
        m.setFlagged(false);
        mentionRepository.saveAndFlush(m);
    }

    @Test
    void testGenerateMorning_shouldIncludeApropoBlockAndRefAndRecordUse_whenYesterdayPersonMatchExists() {
        UUID user = userPopulator.createUser("morning-apropo@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        PersonEntity bela = personPopulator.createPerson(user, "Béla");
        personMention(user, bela.getId(),
                DAY.minusDays(1).atStartOfDay(ZoneId.systemDefault()).plusHours(18).toInstant());
        effectRow(user, EffectLinkEntity.SUBJECT_PERSON, bela.getId().toString(),
                EffectLinkEntity.METRIC_MENTAL, -0.7);
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[]}]");

        CompanionMessageEntity message = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("AKTUÁLIS APROPÓ");
        assertThat(message.getContent().refs()).extracting("kind").contains("Effect");
        assertThat(proactiveMemoryUseRepository.findByCreatedByAndUsedOnGreaterThanEqual(user, DAY))
                .hasSize(1);
    }

    @Test
    void testGenerateWindow_shouldIncludeApropoBlockAndRecordUse_whenSameDayMatchExists() {
        UUID user = userPopulator.createUser("evening-apropo@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        contextMention(user, personPopulator.createPerson(user, "Anna").getId(),
                DAY.atStartOfDay(ZoneId.systemDefault()).plusHours(9).toInstant(), "kozos_program");
        effectRow(user, EffectLinkEntity.SUBJECT_EVENT, "kozos_program",
                EffectLinkEntity.METRIC_STRESS, 0.7);
        checkInPopulator.createCheckIn(user, DAY, "20:00", 3, 2,
                "[fake-heartbeat:Szép napot zártál.]");

        CompanionMessageEntity message =
                companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_EVENING);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("AKTUÁLIS APROPÓ");
        assertThat(message.getContent().refs()).extracting("kind").contains("Effect");
        assertThat(proactiveMemoryUseRepository.findByCreatedByAndUsedOnGreaterThanEqual(user, DAY))
                .hasSize(1);
    }
}
