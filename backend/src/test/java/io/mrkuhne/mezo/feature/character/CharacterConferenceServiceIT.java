package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterPortraitRevisionEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterConferenceService;
import io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog;
import io.mrkuhne.mezo.feature.character.service.CharacterFeedbackService;
import io.mrkuhne.mezo.feature.character.service.PortraitWriter;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the weekly konzílium orchestration (mezo-1gim.5): the honest empty week (no unconsumed
 * observations -> null, no LLM calls), the canned end-to-end happy path (proposal + verdict
 * rounds, claim persistence, observation consumption, portrait rewrite), idempotency, the
 * portrait-failure isolation contract, and chapter opening.
 */
@ActiveProfiles("companion-fake")
class CharacterConferenceServiceIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday

    @Autowired private CharacterConferenceService conferenceService;
    @Autowired private CharacterConferenceRepository conferenceRepository;
    @Autowired private CharacterObservationRepository observationRepository;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private CharacterPortraitRevisionRepository portraitRevisionRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(key);
        entity.setKind("CORE");
        entity.setExpertKey(expertKey);
        return dimensionRepository.save(entity);
    }

    private CharacterObservationEntity seedObservation(UUID owner, String expertKey, LocalDate day, String text,
                                                        short salience) {
        CharacterExpertCatalog.Expert expert = CharacterExpertCatalog.byKey(expertKey);
        CharacterObservationEntity entity = new CharacterObservationEntity();
        entity.setCreatedBy(owner);
        entity.setExpertKey(expertKey);
        entity.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of(expert.primaryDimensionKey())));
        entity.setDay(day);
        entity.setText(text);
        entity.setSalience(salience);
        entity.setSignals(new ObservationSignalsEnvelope(List.of()));
        return observationRepository.save(entity);
    }

    @Test
    void markers_mirroredInFakeLlm_stayInSync() {
        assertThat(FakeCompanionLlm.PORTRAIT_MARKER_MIRROR).isEqualTo(PortraitWriter.PORTRAIT_MARKER);
    }

    @Test
    void runWeekly_emptyWeek_returnsNull_noRowsNoClaims() {
        UUID owner = ownerId();

        CharacterConferenceEntity result = conferenceService.runWeekly(owner, WEEK_START);

        assertThat(result).isNull();
        assertThat(conferenceRepository.findByCreatedByAndKindAndWeekStart(owner, "WEEKLY", WEEK_START)).isEmpty();
        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).isEmpty();
    }

    @Test
    void runWeekly_cannedEndToEnd_persistsConferenceClaimsAndPortraits() {
        UUID owner = ownerId();
        seedDimension(owner, "discipline", "drill");
        seedDimension(owner, "mental", "pszichologus");
        CharacterObservationEntity drillObservation =
                seedObservation(owner, "drill", WEEK_START.plusDays(1), "3 napja nincs kaja-log.", (short) 4);
        CharacterObservationEntity psyObservation =
                seedObservation(owner, "pszichologus", WEEK_START.plusDays(2), "Feszült napló.", (short) 3);

        CharacterConferenceEntity conference = conferenceService.runWeekly(owner, WEEK_START);

        assertThat(conference).isNotNull();
        assertThat(conference.getKind()).isEqualTo("WEEKLY");
        assertThat(conference.getWeekStart()).isEqualTo(WEEK_START);

        assertThat(conference.getTranscript().turns())
                .extracting(ConferenceTranscriptEnvelope.Turn::persona)
                .containsExactlyInAnyOrder("drill", "pszichologus", "szkeptikus", "mezo");

        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).hasSize(2);

        CharacterObservationEntity refreshedDrill =
                observationRepository.findById(drillObservation.getId()).orElseThrow();
        CharacterObservationEntity refreshedPsy =
                observationRepository.findById(psyObservation.getId()).orElseThrow();
        assertThat(refreshedDrill.getConsumedByConferenceId()).isEqualTo(conference.getId());
        assertThat(refreshedPsy.getConsumedByConferenceId()).isEqualTo(conference.getId());

        CharacterDimensionEntity discipline = dimensionRepository.findByCreatedByAndKey(owner, "discipline").orElseThrow();
        CharacterDimensionEntity mental = dimensionRepository.findByCreatedByAndKey(owner, "mental").orElseThrow();
        assertThat(discipline.getPortrait()).isNotBlank();
        assertThat(discipline.getVersion()).isEqualTo(1);
        assertThat(mental.getPortrait()).isNotBlank();
        assertThat(mental.getVersion()).isEqualTo(1);

        List<CharacterPortraitRevisionEntity> disciplineRevisions =
                portraitRevisionRepository.findByCreatedByAndDimensionIdOrderByVersionDesc(owner, discipline.getId());
        assertThat(disciplineRevisions).singleElement().satisfies(r -> {
            assertThat(r.getVersion()).isEqualTo(1);
            assertThat(r.getPortrait()).isEqualTo(discipline.getPortrait());
            assertThat(r.getConferenceId()).isEqualTo(conference.getId());
        });
        List<CharacterPortraitRevisionEntity> mentalRevisions =
                portraitRevisionRepository.findByCreatedByAndDimensionIdOrderByVersionDesc(owner, mental.getId());
        assertThat(mentalRevisions).singleElement()
                .satisfies(r -> assertThat(r.getVersion()).isEqualTo(1));

        assertThat(conference.getOutcome().changes()).extracting(ConferenceOutcomeEnvelope.Change::kind)
                .contains("CLAIM_ACCEPTED", "PORTRAIT_REWRITTEN");
    }

    @Test
    void runWeekly_secondCallSameWeek_isIdempotent_returnsSameRow_noNewClaimsOrRevisions() {
        UUID owner = ownerId();
        seedDimension(owner, "discipline", "drill");
        seedObservation(owner, "drill", WEEK_START.plusDays(1), "3 napja nincs kaja-log.", (short) 4);

        CharacterConferenceEntity first = conferenceService.runWeekly(owner, WEEK_START);
        int claimsAfterFirst = claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE").size();
        CharacterDimensionEntity dimension = dimensionRepository.findByCreatedByAndKey(owner, "discipline").orElseThrow();
        int revisionsAfterFirst =
                portraitRevisionRepository.findByCreatedByAndDimensionIdOrderByVersionDesc(owner, dimension.getId()).size();

        CharacterConferenceEntity second = conferenceService.runWeekly(owner, WEEK_START);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE"))
                .hasSize(claimsAfterFirst);
        assertThat(portraitRevisionRepository.findByCreatedByAndDimensionIdOrderByVersionDesc(owner, dimension.getId()))
                .hasSize(revisionsAfterFirst);
    }

    @Test
    void runWeekly_portraitAnswerBlank_isolatedFailure_claimLandsButPortraitUntouched() {
        UUID owner = ownerId();
        seedDimension(owner, "discipline", "drill");
        // the NEW proposal's own text carries the empty-payload portrait sentinel — it survives
        // into the claim's text, which the portrait user message renders back to the fake LLM
        seedObservation(owner, "drill", WEEK_START.plusDays(1),
                "Jel. [fake-char-proposals:["
                + "{\"kind\":\"NEW\",\"dimensionKey\":\"discipline\","
                + "\"text\":\"Fegyelmezetlen hét volt. [fake-char-portrait:]\","
                + "\"confidence\":0.6,\"sensitive\":false,\"rationale\":\"3 nap kihagyás.\"}"
                + "]]", (short) 4);

        CharacterConferenceEntity conference = conferenceService.runWeekly(owner, WEEK_START);

        assertThat(conference).isNotNull();
        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).hasSize(1);

        CharacterDimensionEntity discipline = dimensionRepository.findByCreatedByAndKey(owner, "discipline").orElseThrow();
        assertThat(discipline.getPortrait()).isEmpty();
        assertThat(discipline.getVersion()).isZero();
        assertThat(portraitRevisionRepository.findByCreatedByAndDimensionIdOrderByVersionDesc(owner, discipline.getId()))
                .isEmpty();

        assertThat(conference.getOutcome().changes()).extracting(ConferenceOutcomeEnvelope.Change::kind)
                .contains("CLAIM_ACCEPTED")
                .doesNotContain("PORTRAIT_REWRITTEN");
    }

    @Test
    void runWeekly_integratorProposesChapter_opensChapterDimension_withSluggedKeyAndChange() {
        UUID owner = ownerId();
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":[{\"index\":0,\"accept\":false,\"confidence\":0.1,\"reason\":\"elutasítva\"}],"
                + "\"chapters\":[{\"title\":\"Uj Fejezet\",\"rationale\":\"tényleg önálló téma\"}]"
                + "}]";
        // the integrator sentinel rides in the proposal's rationale field, exactly as
        // KonziliumVerdictRoundIT plants it — the numbered-proposals block the integrator sees
        // always includes each proposal's rationale text
        seedObservation(owner, "drill", WEEK_START.plusDays(1),
                "Jel. [fake-char-proposals:["
                + "{\"kind\":\"NEW\",\"dimensionKey\":\"discipline\",\"text\":\"Javaslat.\","
                + "\"confidence\":0.5,\"sensitive\":false,\"rationale\":\"" + escape(integratorSentinel) + "\"}"
                + "]]", (short) 4);

        CharacterConferenceEntity conference = conferenceService.runWeekly(owner, WEEK_START);

        assertThat(conference).isNotNull();
        CharacterDimensionEntity chapter = dimensionRepository.findByCreatedByAndKey(owner, "uj-fejezet").orElseThrow();
        assertThat(chapter.getKind()).isEqualTo("CHAPTER");
        assertThat(chapter.getTitle()).isEqualTo("Uj Fejezet");

        assertThat(conference.getOutcome().changes())
                .anySatisfy(c -> {
                    assertThat(c.kind()).isEqualTo("CHAPTER_OPENED");
                    assertThat(c.dimensionKey()).isEqualTo("uj-fejezet");
                });
    }

    @Test
    void runWeekly_priorWeekUnconsumedStraggler_sweptIntoTargetWeeksConference_bothConsumed() {
        // CharacterObservationJob only writes day D's observations at 02:50 on D+1, so the Sunday
        // 19:30 konzílium for the week ending TODAY never sees that Sunday's own observations —
        // they land as unconsumed stragglers dated in the PREVIOUS week from the next konzílium's
        // point of view (final-review finding I2, mezo-1gim.5).
        UUID owner = ownerId();
        seedDimension(owner, "discipline", "drill");
        CharacterObservationEntity straggler =
                seedObservation(owner, "drill", WEEK_START.minusDays(1), "Előző heti, fel nem dolgozott jel.",
                        (short) 4);
        CharacterObservationEntity inWeek =
                seedObservation(owner, "drill", WEEK_START.plusDays(1), "3 napja nincs kaja-log.", (short) 4);

        CharacterConferenceEntity conference = conferenceService.runWeekly(owner, WEEK_START);

        assertThat(conference).isNotNull();
        CharacterObservationEntity refreshedStraggler = observationRepository.findById(straggler.getId()).orElseThrow();
        CharacterObservationEntity refreshedInWeek = observationRepository.findById(inWeek.getId()).orElseThrow();
        assertThat(refreshedStraggler.getConsumedByConferenceId()).isEqualTo(conference.getId());
        assertThat(refreshedInWeek.getConsumedByConferenceId()).isEqualTo(conference.getId());
    }

    @Test
    void runWeekly_talalOnlyRound_logsNoUnaddressedCorrectionWarning() {
        // fix round 2 (F1/F3, mezo-1gim.10): a TALAL confirmation carries no obligation to be
        // addressed by a proposal, so CharacterConferenceService's unaddressed-correction WARN
        // must stay silent for a round whose only user-feedback observation is a TALAL — firing
        // routinely on plain confirmations would teach people to ignore the log.
        UUID owner = ownerId();
        seedDimension(owner, "discipline", "drill");
        UUID claimId = UUID.randomUUID();
        CharacterObservationEntity talal = new CharacterObservationEntity();
        talal.setCreatedBy(owner);
        talal.setExpertKey(CharacterFeedbackService.USER_EXPERT_KEY);
        talal.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        talal.setDay(WEEK_START.plusDays(1));
        talal.setText("[" + claimId + "] A felhasználó megerősítette: \"Rendszeresen naplózik.\""
                + " (a bizalom már beszámítva)");
        talal.setSalience((short) 3);
        talal.setSignals(new ObservationSignalsEnvelope(List.of(new ObservationSignalsEnvelope.Signal(
                CharacterFeedbackService.SIGNAL_KEY, "talál", List.of(claimId.toString())))));
        observationRepository.save(talal);

        Logger logger = (Logger) LoggerFactory.getLogger(CharacterConferenceService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            CharacterConferenceEntity conference = conferenceService.runWeekly(owner, WEEK_START);

            assertThat(conference).isNotNull();
            assertThat(appender.list).noneMatch(event -> event.getFormattedMessage().contains("unaddressed"));
        } finally {
            logger.detachAppender(appender);
        }
    }

    /** Escapes a JSON string value's double quotes/backslashes so it can be nested as another
     *  JSON string's content (the integrator sentinel embedded inside a proposal's rationale). */
    private static String escape(String raw) {
        return raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
