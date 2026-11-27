package io.mrkuhne.mezo.feature.capacity.mapper;

import io.mrkuhne.mezo.api.dto.CapacityCompareLine;
import io.mrkuhne.mezo.api.dto.CapacityHistoryItem;
import io.mrkuhne.mezo.api.dto.CapacityPattern;
import io.mrkuhne.mezo.api.dto.CapacityProposal;
import io.mrkuhne.mezo.api.dto.CapacityProposalStep;
import io.mrkuhne.mezo.api.dto.CapacityWeek;
import io.mrkuhne.mezo.api.dto.CapacityWeekDay;
import io.mrkuhne.mezo.feature.capacity.service.CapacityDay;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService.PatternView;
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
            .patterns(w.patterns().stream().map(CapacityProposalMapper::pattern).toList())
            .history(w.history().stream().map(h -> CapacityHistoryItem.builder()
                .proposalId(h.proposalId())
                .kind(CapacityHistoryItem.KindEnum.fromValue(h.kind()))
                .day(h.day())
                .status(CapacityHistoryItem.StatusEnum.fromValue(h.status()))
                .title(h.title())
                .word(h.word())
                .sub(h.sub())
                .good(h.good())
                .build()).toList())
            .allEffects(w.allEffects() == null ? null : w.allEffects().stream().map(l -> CapacityCompareLine.builder()
                .label(l.label()).before(l.before()).after(l.after()).favours(l.favours()).build()).toList())
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
            .outcomeWord(p.outcomeWord())
            .outcomeSub(p.outcomeSub())
            .build();
    }

    /** A shown learned pattern (the week, the season and the new-season hints share it). */
    public static CapacityPattern pattern(PatternView p) {
        return CapacityPattern.builder().key(p.key()).line(p.line()).body(p.body()).evidence(p.evidence())
            .consistent(p.consistent()).weekday(p.weekday()).build();
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
