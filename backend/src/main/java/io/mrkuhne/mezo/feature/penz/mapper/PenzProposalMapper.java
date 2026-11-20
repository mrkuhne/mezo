package io.mrkuhne.mezo.feature.penz.mapper;

import io.mrkuhne.mezo.api.dto.PenzProduct;
import io.mrkuhne.mezo.api.dto.PenzProposal;
import io.mrkuhne.mezo.api.dto.PenzProposalFact;
import io.mrkuhne.mezo.api.dto.PenzProposalOption;
import io.mrkuhne.mezo.api.dto.PenzProposalSleeve;
import io.mrkuhne.mezo.api.dto.PenzProposalStep;
import io.mrkuhne.mezo.feature.penz.entity.PenzProductEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalJson;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.mapstruct.Mapper;

/** Catalog products and proposals ↔ the {@code PenzCatalog} / {@code PenzProposal} shapes (mezo-r36n9.105). */
@Mapper(componentModel = "spring")
public interface PenzProposalMapper {

    default PenzProduct product(PenzProductEntity e) {
        List<PenzProduct.SleevesEnum> sleeves = new ArrayList<>();
        e.getSleeves().forEach(s -> sleeves.add(PenzProduct.SleevesEnum.fromValue(s)));
        return new PenzProduct()
            .id(e.getId())
            .name(e.getName())
            .kind(PenzProduct.KindEnum.fromValue(e.getKind()))
            .currency(e.getCurrency())
            .sleeves(sleeves)
            .whatItIs(e.getWhatItIs())
            .terPct(e.getTerPct())
            .entryFeePct(e.getEntryFeePct())
            .feeNote(e.getFeeNote())
            .distribution(PenzProduct.DistributionEnum.fromValue(e.getDistribution()))
            .isin(e.getIsin())
            .symbol(e.getSymbol())
            .sourceName(e.getSourceName())
            .sourceUrl(e.getSourceUrl())
            .reviewedAt(e.getReviewedAt())
            .status(PenzProduct.StatusEnum.fromValue(e.getStatus()))
            .suggestedBy(PenzProduct.SuggestedByEnum.fromValue(e.getSuggestedBy()))
            .approvedAt(time(e.getApprovedAt()));
    }

    default PenzProposal proposal(PenzProposalEntity e) {
        PenzProposalJson b = e.getBody();
        List<PenzProposalFact> facts = new ArrayList<>();
        b.facts().forEach(f -> facts.add(new PenzProposalFact().value(f.value()).unit(f.unit()).label(f.label())));
        List<PenzProposalSleeve> sleeves = new ArrayList<>();
        b.sleeves().forEach(s -> sleeves.add(sleeve(s)));
        List<PenzProposalStep> plan = new ArrayList<>();
        e.getPlan().forEach(p -> plan.add(new PenzProposalStep()
            .index(p.index())
            .sleeve(PenzProposalStep.SleeveEnum.fromValue(p.sleeve()))
            .productId(p.productId())
            .productName(p.productName())
            .amountHufMinor(p.amountHufMinor())
            .done(p.done())
            .doneAt(time(p.doneAt()))));
        return new PenzProposal()
            .id(e.getId())
            .kind(PenzProposal.KindEnum.fromValue(e.getKind()))
            .status(PenzProposal.StatusEnum.fromValue(e.getStatus()))
            .amountHufMinor(e.getAmountHufMinor())
            .createdAt(time(e.getCreatedAt()))
            .acceptedAt(time(e.getAcceptedAt()))
            .title(b.title())
            .sub(b.sub())
            .summary(b.summary())
            .uncertainty(b.uncertainty())
            .narratedBy(PenzProposal.NarratedByEnum.fromValue(b.narratedBy()))
            .facts(facts)
            .rules(new ArrayList<>(b.rules()))
            .sleeves(sleeves)
            .plan(plan);
    }

    private PenzProposalSleeve sleeve(PenzProposalJson.SleeveJson s) {
        List<PenzProposalOption> options = new ArrayList<>();
        s.options().forEach(o -> options.add(new PenzProposalOption()
            .productId(o.productId())
            .name(o.name())
            .whatItIs(o.whatItIs())
            .kind(PenzProposalOption.KindEnum.fromValue(o.kind()))
            .currency(o.currency())
            .distribution(PenzProposalOption.DistributionEnum.fromValue(o.distribution()))
            .terPct(o.terPct())
            .entryFeePct(o.entryFeePct())
            .feeNote(o.feeNote())
            .yearlyCostHufMinor(o.yearlyCostHufMinor())
            .reviewedAt(o.reviewedAt())
            .differs(new ArrayList<>(o.differs()))));
        return new PenzProposalSleeve()
            .sleeve(PenzProposalSleeve.SleeveEnum.fromValue(s.sleeve()))
            .label(s.label())
            .amountHufMinor(s.amountHufMinor())
            .sharePct(s.sharePct())
            .why(s.why())
            .optionsNote(s.optionsNote())
            .options(options);
    }

    private static OffsetDateTime time(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
