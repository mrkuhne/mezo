package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzProposal;
import io.mrkuhne.mezo.api.dto.PenzProposalAcceptRequest;
import io.mrkuhne.mezo.api.dto.PenzProposalAcceptSleeve;
import io.mrkuhne.mezo.api.dto.PenzProposalRequest;
import io.mrkuhne.mezo.feature.penz.entity.PenzProductEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalJson.OptionJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalJson.SleeveJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalJson.StepJson;
import io.mrkuhne.mezo.feature.penz.mapper.PenzProposalMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzProductRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzProposalRepository;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.CatalogProduct;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProductOptions;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProductOptions.Option;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProductOptions.SleeveOptions;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalFallbackCopy;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalFigures;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalNarration;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalPrompt;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalSplitter;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalSplitter.Split;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalValidator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The investment proposal flow (Boop Pénz L7, mezo-r36n9.105, build notes calls 11–15; spec §5.5).
 *
 * <p>{@link #create}: the amount (his, or the strategy figure for {@code monthly}) → the split
 * ({@link ProposalSplitter}: emergency target from the allowance engine's {@code fixedCosts} and his settings, the
 * short sleeve's value from Pénzem) → the options per sleeve from his <b>approved</b> products only
 * ({@link ProductOptions}) → the figures → ONE narration call outside any transaction ({@link PenzProposalLlm};
 * the answer normalised ({@link ProposalNarration#normalised}: cleaned, NFKC, one kind of space) and both validated
 * and stored in that form; absent, refused, unparsable or rejected by {@link ProposalValidator} →
 * {@link ProposalFallbackCopy}) → one short
 * write ({@link PenzProposalStore}, superseding the still-proposed one of the same kind). Rejections are logged by rule
 * only, never prose.
 *
 * <p>{@link #accept} takes HIS numbers: per sleeve at most once, {@code amount ≥ 0}; a product must be one of that
 * sleeve's offered options AND still approved, re-checked now ({@code PENZ_PRODUCT_NOT_APPROVED}); the plan is the
 * sleeves with an amount, in horizon order. A tick ({@link #step}) records nothing anywhere else.
 *
 * <p><b>Nothing here moves money</b>: no transaction, holding or investment row is ever written by this service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PenzProposalService {

    /** 1 000 Ft — the smallest amount the split rounds to. */
    static final long MIN_AMOUNT_MINOR = ProposalSplitter.ROUND_TO_MINOR;

    private final PenzProposalRepository repository;
    private final PenzProductRepository products;
    private final PenzProposalStore store;
    private final PenzCatalogService catalog;
    private final PenzStrategyService strategy;
    private final PenzAllowanceService allowance;
    private final PenzSettingsService settings;
    private final PenzProposalMapper mapper;
    private final ObjectProvider<PenzProposalLlm> llm;

    /** A new proposal of {@code req.kind} (see the class doc). */
    public PenzProposal create(UUID owner, PenzProposalRequest req) {
        LocalDate today = settings.today(owner);
        String kind = req.getKind();
        long amount;
        if (PenzProposalEntity.KIND_MONTHLY.equals(kind)) {
            amount = strategy.figure(owner, today).availableMinor();
        } else {
            amount = req.getAmountHufMinor() == null ? 0 : req.getAmountHufMinor();
        }
        if (amount < MIN_AMOUNT_MINOR) {
            throw PenzErrors.badRequest(PenzErrors.PROPOSAL_AMOUNT_INVALID);
        }
        YearMonth month = YearMonth.from(today);
        long fixedCosts = allowance.monthly(owner, month).fixedCostsMinor();
        int months = settings.ensure(owner).getEmergencyFundMonths();
        Split split = ProposalSplitter.split(amount, months, fixedCosts, strategy.shortSleeveValue(owner, today));

        List<CatalogProduct> all = catalog.products(owner);
        List<SleeveOptions> sleeves = new ArrayList<>();
        for (Sleeve s : Sleeve.values()) {
            sleeves.add(ProductOptions.forSleeve(s, split.amount(s), all));
        }
        ProposalFigures figures = new ProposalFigures(split, sleeves);

        Narrated narrated = narrate(owner, kind, figures, all);
        PenzProposalJson body = body(kind, figures, narrated);
        return mapper.proposal(store.insert(owner, kind, amount, month.toString(), body));
    }

    /** His proposals, newest first, optionally of one status. */
    public List<PenzProposal> list(UUID owner, String status) {
        List<PenzProposalEntity> rows = status == null || status.isBlank()
            ? repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner)
            : repository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(owner, status);
        return rows.stream().map(mapper::proposal).toList();
    }

    public PenzProposal get(UUID owner, UUID id) {
        return mapper.proposal(require(owner, id));
    }

    @Transactional
    public PenzProposal accept(UUID owner, UUID id, PenzProposalAcceptRequest req) {
        PenzProposalEntity row = require(owner, id);
        if (!PenzProposalEntity.STATUS_PROPOSED.equals(row.getStatus())) {
            throw PenzErrors.conflict(PenzErrors.PROPOSAL_STATE);
        }
        Map<Sleeve, PenzProposalAcceptSleeve> chosen = new EnumMap<>(Sleeve.class);
        for (PenzProposalAcceptSleeve s : req.getSleeves()) {
            if (chosen.put(Sleeve.of(s.getSleeve()), s) != null) {
                throw PenzErrors.field("sleeves");
            }
        }
        List<StepJson> plan = new ArrayList<>();
        long total = 0;
        for (Sleeve sleeve : Sleeve.values()) {
            PenzProposalAcceptSleeve s = chosen.get(sleeve);
            if (s == null || s.getAmountHufMinor() == null || s.getAmountHufMinor() <= 0) {
                continue;
            }
            PenzProductEntity product = requireOfferedAndApproved(owner, row.getBody(), sleeve, s.getProductId());
            plan.add(new StepJson(plan.size(), sleeve.wire(), product.getId(), product.getName(),
                s.getAmountHufMinor(), false, null));
            total = Math.addExact(total, s.getAmountHufMinor());
        }
        if (total <= 0) {
            throw PenzErrors.badRequest(PenzErrors.PROPOSAL_AMOUNT_INVALID);
        }
        Instant now = now();
        row.setPlan(plan);
        row.setStatus(PenzProposalEntity.STATUS_ACCEPTED);
        row.setAcceptedAt(now);
        row.setUpdatedAt(now);
        return mapper.proposal(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzProposal dismiss(UUID owner, UUID id) {
        PenzProposalEntity row = require(owner, id);
        if (!PenzProposalEntity.STATUS_PROPOSED.equals(row.getStatus())) {
            throw PenzErrors.conflict(PenzErrors.PROPOSAL_STATE);
        }
        row.setStatus(PenzProposalEntity.STATUS_DISMISSED);
        row.setUpdatedAt(now());
        return mapper.proposal(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzProposal step(UUID owner, UUID id, int index, boolean done) {
        PenzProposalEntity row = require(owner, id);
        if (!PenzProposalEntity.STATUS_ACCEPTED.equals(row.getStatus())) {
            throw PenzErrors.conflict(PenzErrors.PROPOSAL_STATE);
        }
        List<StepJson> plan = new ArrayList<>(row.getPlan());
        if (index < 0 || index >= plan.size()) {
            throw PenzErrors.notFound(PenzErrors.PROPOSAL_NOT_FOUND);
        }
        StepJson s = plan.get(index);
        Instant doneAt = done ? (s.done() && s.doneAt() != null ? s.doneAt() : now()) : null;
        plan.set(index, new StepJson(s.index(), s.sleeve(), s.productId(), s.productName(), s.amountHufMinor(), done,
            doneAt));
        row.setPlan(plan);
        row.setUpdatedAt(now());
        return mapper.proposal(repository.saveAndFlush(row));
    }

    private PenzProposalEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound(PenzErrors.PROPOSAL_NOT_FOUND));
    }

    /** One of the sleeve's offered options AND, now, still a live approved product of his. */
    private PenzProductEntity requireOfferedAndApproved(UUID owner, PenzProposalJson body, Sleeve sleeve,
                                                        UUID productId) {
        boolean offered = productId != null && body.sleeves().stream()
            .filter(s -> s.sleeve().equals(sleeve.wire()))
            .flatMap(s -> s.options().stream())
            .anyMatch(o -> productId.equals(o.productId()));
        if (!offered) {
            throw PenzErrors.conflict(PenzErrors.PRODUCT_NOT_APPROVED);
        }
        return products.findByIdAndCreatedByAndDeletedFalse(productId, owner)
            .filter(p -> PenzProductEntity.STATUS_APPROVED.equals(p.getStatus()))
            .orElseThrow(() -> PenzErrors.conflict(PenzErrors.PRODUCT_NOT_APPROVED));
    }

    private record Narrated(ProposalNarration narration, String narratedBy) {
    }

    private Narrated narrate(UUID owner, String kind, ProposalFigures figures, List<CatalogProduct> catalog) {
        PenzProposalLlm model = llm.getIfAvailable();
        String raw = model == null ? null
            : model.narrate(ProposalPrompt.SYSTEM_PROMPT, ProposalPrompt.userMessage(kind, figures)).orElse(null);
        Optional<ProposalNarration> parsed = ProposalNarration.parse(raw).map(ProposalNarration::normalised);
        List<DigestViolation.Rule> rejected = List.of();
        if (parsed.isPresent()) {
            List<DigestViolation> violations = ProposalValidator.validate(parsed.get(), figures, catalog);
            if (violations.isEmpty()) {
                log.info("Penz proposal for owner {}: model narration kept", owner);
                return new Narrated(parsed.get(), PenzProposalJson.NARRATED_BY_MODEL);
            }
            rejected = violations.stream().map(DigestViolation::rule).distinct().toList();
        }
        log.info("Penz proposal for owner {}: model answered={}, parsed={}, fallback, rejected={}", owner,
            raw != null, parsed.isPresent(), rejected);
        return new Narrated(ProposalFallbackCopy.narration(figures), PenzProposalJson.NARRATED_BY_FALLBACK);
    }

    private static PenzProposalJson body(String kind, ProposalFigures figures, Narrated narrated) {
        Split split = figures.split();
        List<SleeveJson> sleeves = new ArrayList<>();
        for (Sleeve s : Sleeve.values()) {
            SleeveOptions so = figures.options(s);
            List<OptionJson> options = new ArrayList<>();
            for (Option o : so.options()) {
                CatalogProduct p = o.product();
                options.add(new OptionJson(p.id(), p.name(), p.whatItIs(), p.kind(), p.currency(), p.distribution(),
                    p.terPct(), p.entryFeePct(), p.feeNote(), o.yearlyCostHufMinor(), p.reviewedAt(), o.differs()));
            }
            sleeves.add(new SleeveJson(s.wire(), ProposalFigures.horizon(s), split.amount(s), split.sharePct(s),
                narrated.narration().why(s), so.note(), options));
        }
        List<PenzProposalJson.Fact> facts = figures.facts().stream()
            .map(f -> new PenzProposalJson.Fact(f.value(), f.unit(), f.label())).toList();
        return new PenzProposalJson(ProposalFallbackCopy.title(kind, split.amountMinor()),
            ProposalFallbackCopy.sub(split), narrated.narration().summary(), narrated.narration().uncertainty(),
            narrated.narratedBy(), facts, ProposalFallbackCopy.rules(split), sleeves);
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
