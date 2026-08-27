package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssemblerJob;
import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewJob;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * W5.3 final review (mezo-b3pp.20, F2): the PROFILE job switch must not be leaky.
 *
 * <p>{@code mezo.techcore.cron.profile-assembler-job.enabled=false} is a documented kill switch:
 * no weekly rebuild, no smart-tier spend for the profile, and an archived "Rólad tanultam" node
 * stays archived. Before the fix the quarterly cron called {@code ProfileAssembler.rebuild}
 * unconditionally, so four times a year it would spend that call anyway and force the node back to
 * ACTIVE — undoing the operator's switch behind their back. This IT pins BOTH halves of the fix at
 * once, which is the only way to prove the gate is per-PHASE rather than a blunt "skip the job":
 * phase 1 (season candidates) still runs, phase 2 (profile) does not.
 *
 * <p>The switch is read by BEAN PRESENCE ({@code @Value} is banned in this repo), so the absent
 * {@link ProfileAssemblerJob} bean asserted below is not incidental setup — it IS the mechanism
 * under test.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.profile-assembler-job.enabled=false")
class QuarterlyReviewJobProfileSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private QuarterlyReviewJob quarterlyReviewJob;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ApplicationContext context;

    @Test
    void testRun_shouldStillProposeSeasonsButWriteNoProfile_whenTheProfileJobSwitchIsOff() {
        assertThat(context.getBeanProvider(ProfileAssemblerJob.class).getIfAvailable()).isNull();
        UUID owner = userPopulator.createUser().getId();
        LocalDate quarter = Quarters.previous(Quarters.startOf(LocalDate.now()));
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, quarter,
                "A negyedév első hónapja. [fake-season:[{\"title\":\"Nyugodt szezon\","
                        + "\"summary\":\"Kiegyensúlyozott negyedév volt.\"}]]");
        // The same reviewed-decision fixture QuarterlyReviewJobIT uses to OPEN ProfileAssembler's
        // honest-absence gate. It is load-bearing here in the negative: with the switch ON this
        // user's profile node WOULD be written (that is exactly what QuarterlyReviewJobIT asserts),
        // so its absence below can only be the switch, never a missing signal.
        journalPopulator.createReviewedDecision(owner, quarter, "Heti 3 edzés", 4, "Bevált.");

        quarterlyReviewJob.run();

        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE))
                .anySatisfy(n -> assertThat(n.getKind()).isEqualTo(GraphNodeEntity.KIND_SEASON));
        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, ProfileAssembler.SOURCE_PROFILE, owner)).isEmpty();
    }

    /**
     * The resurrection half of the same bug: the assembler deliberately re-ACTIVATES an archived
     * profile ("reset what you think of me"), so with the profile job switched off the quarterly
     * pass must not reach that code at all — an archived node has to still be archived afterwards.
     */
    @Test
    void testRun_shouldLeaveAnArchivedProfileArchived_whenTheProfileJobSwitchIsOff() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate quarter = Quarters.previous(Quarters.startOf(LocalDate.now()));
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, quarter,
                "A negyedév első hónapja. [fake-season:[{\"title\":\"Nyugodt szezon\","
                        + "\"summary\":\"Kiegyensúlyozott negyedév volt.\"}]]");
        journalPopulator.createReviewedDecision(owner, quarter, "Heti 3 edzés", 4, "Bevált.");
        GraphNodeEntity archived = graphPopulator.createSourcedNode(owner, GraphNodeEntity.KIND_INSIGHT,
                ProfileAssembler.PROFILE_TITLE, "Régi profil.", ProfileAssembler.SOURCE_PROFILE, owner);
        archived.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        UUID nodeId = nodeRepository.saveAndFlush(archived).getId();

        quarterlyReviewJob.run();

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(nodeRepository.findById(nodeId).orElseThrow().getSummary()).isEqualTo("Régi profil.");
    }
}
