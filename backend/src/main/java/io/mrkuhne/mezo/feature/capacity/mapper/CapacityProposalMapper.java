package io.mrkuhne.mezo.feature.capacity.mapper;

import io.mrkuhne.mezo.api.dto.CapacityCompareLine;
import io.mrkuhne.mezo.api.dto.CapacityPattern;
import io.mrkuhne.mezo.api.dto.CapacityProposal;
import io.mrkuhne.mezo.api.dto.CapacityProposalStep;
import io.mrkuhne.mezo.api.dto.CapacityWeek;
import io.mrkuhne.mezo.api.dto.CapacityWeekDay;
import io.mrkuhne.mezo.feature.capacity.service.CapacityDay;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService.ProposalView;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService.WeekView;
import java.time.ZoneOffset;

/** The Átrendezés week and its proposals to their API shapes (Boop B7 K3, mezo-r36n9.17). */
public final class CapacityProposalMapper {

    private CapacityProposalMapper() {
    }

    public static CapacityWeek toDto(WeekView w) {
        return CapacityWeek.builder()
            .monday(w.monday())
            .days(w.days().stream().map(CapacityProposalMapper::day).toList())
            .proposals(w.proposals().stream().map(CapacityProposalMapper::toDto).toList())
            .adjustments(w.adjustments().stream().map(CapacityAdjustmentMapper::toDto).toList())
            .patterns(w.patterns().stream()
                .map(p -> CapacityPattern.builder().key(p.key()).line(p.line()).evidence(p.evidence()).build())
                .toList())
            .build();
    }

    public static CapacityProposal toDto(ProposalView p) {
        return CapacityProposal.builder()
            .id(p.id())
            .kind(CapacityProposal.KindEnum.fromValue(p.kind()))
            .day(p.day())
            .status(CapacityProposal.StatusEnum.fromValue(p.status().wire()))
            .title(p.title())
            .move(p.move())
            .effectLines(p.effectLines())
            .why(p.why())
            .effects(p.compare().stream().map(l -> CapacityCompareLine.builder().label(l.label()).before(l.before())
                .after(l.after()).favours(l.favours()).build()).toList())
            .steps(p.steps().stream().map(s -> CapacityProposalStep.builder()
                .kind(CapacityProposalStep.KindEnum.fromValue(s.kind())).payload(s.payload()).build()).toList())
            .touchedDays(p.touchedDays())
            .decidedAt(p.decidedAt() == null ? null : p.decidedAt().atOffset(ZoneOffset.UTC))
            .build();
    }

    /** The verdict word ("túl sok") to the wire enum ({@code tulSok}); the word itself goes out as the label. */
    private static CapacityWeekDay day(CapacityDay d) {
        return CapacityWeekDay.builder()
            .date(d.date())
            .verdict(CapacityWeekDay.VerdictEnum.fromValue("túl sok".equals(d.verdict()) ? "tulSok" : d.verdict()))
            .label(d.verdict())
            .ratio(d.ratio())
            .calendarKnown(d.calendarKnown())
            .build();
    }
}
