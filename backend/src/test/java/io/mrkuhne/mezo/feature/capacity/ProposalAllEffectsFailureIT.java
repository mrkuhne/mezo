package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.CapacityProposal;
import io.mrkuhne.mezo.api.dto.CapacityWeek;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentDraft;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload;
import io.mrkuhne.mezo.feature.capacity.service.CrossEffectCalculator;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * K3 final review finding 3: "Ha mindet jóváhagyod" is a bonus block — one failure while computing it must never turn
 * the week read into a 500. The engines throw for the "ALL" draft only; the week still answers with its proposals,
 * and the block is simply absent. Names and figures are invented.
 */
class ProposalAllEffectsFailureIT extends ApiIntegrationTest {

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @MockitoSpyBean private CrossEffectCalculator calculator;
    @Autowired private CapacityProposalRepository proposals;

    private final LocalDate monday = LocalDate.now(BUD).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        .plusWeeks(1);

    private void storedProposal(UUID owner, AdjustmentPayload step) {
        CapacityProposalEntity p = new CapacityProposalEntity();
        p.setCreatedBy(owner);
        p.setWeekStart(monday);
        p.setDay(step.day());
        p.setKind(step.kind().name());
        p.setBundle(AdjustmentDraft.toBundle(List.of(AdjustmentDraft.of(step))));
        p.setTitle("például: később fekszem");
        p.setGeneratorVersion((short) 1);
        p.setStatus("open");
        proposals.saveAndFlush(p);
    }

    @Test
    void allEffectsFailureNeverBreaksTheWeekRead() {
        RegisteredUser user = registerUser("cap-all-fails");
        storedProposal(user.id(), new AdjustmentPayload.ShiftBedtime(monday.plusDays(1), LocalTime.of(23, 0)));
        storedProposal(user.id(), new AdjustmentPayload.ShiftBedtime(monday.plusDays(2), LocalTime.of(23, 15)));
        doThrow(new IllegalStateException("például: engine failure"))
            .when(calculator).effects(any(), any(WeekPicture.class), argThat(d -> d != null && "ALL".equals(d.kind())));

        CapacityWeek w = getForBody("/api/capacity/week?monday=" + monday, user.headers(), HttpStatus.OK,
            CapacityWeek.class);

        assertThat(w.getProposals()).filteredOn(p -> p.getStatus() == CapacityProposal.StatusEnum.OPEN).hasSizeGreaterThanOrEqualTo(2);
        assertThat(w.getAllEffects()).isNull();
    }
}
