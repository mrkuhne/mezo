package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService.Built;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService.Stored;
import io.mrkuhne.mezo.feature.capacity.service.ProposalWordingWriter.Wording;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Boop B7 K3 (mezo-r36n9.17, Task 17 fix round 1): the background rephrase of a stored proposal. A faithful model
 * answer is saved; one that brings a new number keeps the template (digit guard); a row that was decided, or whose
 * words changed, since the set was stored never takes the rephrase — the save re-reads the row under the owner's lock,
 * so it cannot write {@code open} back over an accept. Real clock; the bedtime step sits on next week. Words invented.
 */
class ProposalRephraseIT extends AbstractIntegrationTest {

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");
    private static final String FAITHFUL = """
        {"title":"Vidd át a lábnapot szombatra","effectLines":["Csütörtök szorosra enyhül, szombat rendben lesz",
        "A 290 kcal többlet szombaton jár, ha megcsinálod","Vasárnap röpi előtt nem pihensz",
        "A heti 4 edzés marad"],"why":["Csütörtökön 6 óra megbeszélésed van","Szombat üres"]}""";
    private static final String INVENTING = """
        {"title":"Szombatra vele","effectLines":["Csütörtök könnyebb lesz","3 óra pihenőt nyersz",
        "A 290 kcal szombaton jár","A heti 4 edzés marad"],"why":["Sok a megbeszélés","Szombat üres"]}""";

    @Autowired private ProposalService service;
    @Autowired private DayAdjustmentService ledger;
    @Autowired private CapacityProposalRepository proposals;
    @Autowired private DatabasePopulator databasePopulator;

    private final LocalDate night = LocalDate.now(BUD).with(TemporalAdjusters.next(java.time.DayOfWeek.WEDNESDAY))
        .plusWeeks(1);
    private final Wording template = ProposalWordingWriterTest.writer(null)
        .template(ProposalWordingWriterTest.move(), ProposalWordingWriterTest.effects());

    private static ProposalWordingWriter answering(String answer) {
        CompanionLlm llm = mock(CompanionLlm.class);
        when(llm.complete(anyString(), anyString())).thenReturn(answer);
        return ProposalWordingWriterTest.writer(llm);
    }

    /** An open row carrying the template's words, as the week read stores it. */
    private Stored stored(UUID owner) {
        CapacityProposalEntity p = new CapacityProposalEntity();
        p.setCreatedBy(owner);
        p.setWeekStart(night.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY)));
        p.setDay(night);
        p.setKind("SHIFT_BEDTIME");
        p.setBundle(AdjustmentDraft.toBundle(List.of(AdjustmentDraft.of(
            new AdjustmentPayload.ShiftBedtime(night, LocalTime.of(23, 30))))));
        Map<String, Object> effects = new LinkedHashMap<>();
        effects.put("move", template.move());
        effects.put("lines", template.effectLines());
        effects.put("compare", List.of());
        p.setEffects(effects);
        p.setTitle(template.title());
        p.setWhy(template.why());
        p.setGeneratorVersion((short) 1);
        p.setStatus("open");
        UUID id = proposals.saveAndFlush(p).getId();
        return new Stored(id, new Built(ProposalWordingWriterTest.move(), ProposalWordingWriterTest.effects(),
            template, night, null));
    }

    private CapacityProposalEntity reload(Stored s) {
        return proposals.findById(s.id()).orElseThrow();
    }

    @Test
    @SuppressWarnings("unchecked")
    void faithfulRephraseIsSaved() {
        UUID owner = databasePopulator.populateUser("cap-rephrase-" + UUID.randomUUID() + "@test.local");
        Stored s = stored(owner);

        service.rephrase(owner, List.of(s), answering(FAITHFUL));

        CapacityProposalEntity p = reload(s);
        assertThat(p.getTitle()).isEqualTo("Vidd át a lábnapot szombatra");
        assertThat((List<Object>) p.getEffects().get("lines")).hasSize(4)
            .contains("A 290 kcal többlet szombaton jár, ha megcsinálod");
        assertThat(p.getEffects().get("move")).isEqualTo(template.move()); // the from → to line stays the template's
        assertThat(p.getWhy()).containsExactly("Csütörtökön 6 óra megbeszélésed van", "Szombat üres");
        assertThat(p.getStatus()).isEqualTo("open");
    }

    @Test
    void aRephraseWithANewNumberKeepsTheTemplate() {
        UUID owner = databasePopulator.populateUser("cap-rephrase-" + UUID.randomUUID() + "@test.local");
        Stored s = stored(owner);

        service.rephrase(owner, List.of(s), answering(INVENTING));

        CapacityProposalEntity p = reload(s);
        assertThat(p.getTitle()).isEqualTo(template.title());
        assertThat(p.getEffects().get("lines")).isEqualTo(template.effectLines());
        assertThat(p.getWhy()).isEqualTo(template.why());
    }

    @Test
    void anAcceptBeforeTheSaveStaysAccepted() {
        UUID owner = databasePopulator.populateUser("cap-rephrase-" + UUID.randomUUID() + "@test.local");
        Stored s = stored(owner);
        Wording rephrased = answering(FAITHFUL).word(ProposalWordingWriterTest.move(),
            ProposalWordingWriterTest.effects());
        // the model answered; meanwhile he accepted the card
        ledger.applyBundle(owner, s.id(), UUID.randomUUID());

        boolean saved = service.reword(owner, s, rephrased);

        assertThat(saved).isFalse();
        CapacityProposalEntity p = reload(s);
        assertThat(p.getStatus()).isEqualTo("accepted");
        assertThat(p.getDecidedAt()).isNotNull();
        assertThat(p.getTitle()).isEqualTo(template.title());
    }

    @Test
    void aRowWhoseWordsChangedIsLeftAlone() {
        UUID owner = databasePopulator.populateUser("cap-rephrase-" + UUID.randomUUID() + "@test.local");
        Stored s = stored(owner);
        CapacityProposalEntity p = reload(s);
        p.setTitle("például: más szöveg");
        proposals.saveAndFlush(p);

        service.rephrase(owner, List.of(s), answering(FAITHFUL));

        assertThat(reload(s).getTitle()).isEqualTo("például: más szöveg");
        assertThat(reload(s).getStatus()).isEqualTo("open");
    }
}
