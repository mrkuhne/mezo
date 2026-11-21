package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzWeeklyReviewResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklyReviewEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklySectionJson;
import io.mrkuhne.mezo.feature.penz.mapper.PenzWeeklyReviewMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzDigestRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzPortfolioService.PenzPositionView;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation;
import io.mrkuhne.mezo.feature.penz.service.news.NewsHolding;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklyReviewAssembler;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklyReviewPrompt;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklyReviewSectioner;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklySection;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Builds and reads the owner's weekly long-horizon review (Boop Pénz, mezo-r36n9.120, spec §5.1: the daily digest
 * reports what moved; the long-horizon verdict is weekly, because the cadence is the filter).
 *
 * <p>{@link #buildIfMissing}, called by the news run after each user's daily digest: the previous complete
 * Monday–Sunday week of his today (money timezone); when no row exists for it — or only a {@code failed} one — the
 * week's stored digests → de-duplicated stories → three sleeve sections with backend figures
 * ({@link WeeklyReviewSectioner}; current live holdings, the long sleeve's coverage months as Pénzem computes them)
 * → ONE narration call outside any transaction ({@link PenzWeeklyReviewLlm}) → the validator gate
 * ({@link WeeklyReviewAssembler}) → one short write ({@link PenzWeeklyReviewStore}): {@code ready} when any sleeve
 * had stories and the model answered (or no model is configured: fallback copy); {@code quiet} when the week's digest
 * rows exist but no sleeve had a story (no model call); {@code failed} when the build itself broke, or when the model
 * gave no usable answer at all (empty, refused, unparseable — a passing outage; stored with the fallback sections so
 * GET shows something honest) — the next run retries either. A week with no digest row at all is not stored (its
 * digests may not exist yet; a premature {@code quiet} would freeze it) — mezo-r36n9.119 review. No new feed fetch,
 * no article body, no push, no action. Rejections are logged
 * by sleeve and rule names only — never prose or titles.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PenzWeeklyReviewService {

    private final PenzDigestRepository digests;
    private final PenzPortfolioService portfolio;
    private final PenzWeeklyReviewStore store;
    private final PenzSettingsService settings;
    private final PenzWeeklyReviewMapper mapper;
    private final ObjectProvider<PenzWeeklyReviewLlm> llm;

    /**
     * The owner's review of the week {@code week} falls in (a Monday; any other day means its week); without
     * {@code week} the latest stored one, else {@code pending} for the previous complete week.
     */
    public PenzWeeklyReviewResponse get(UUID owner, LocalDate week) {
        if (week != null) {
            LocalDate start = WeeklyReviewSectioner.weekStartOf(week);
            return store.find(owner, start).map(mapper::review).orElseGet(() -> mapper.pending(start));
        }
        return store.latest(owner).map(mapper::review)
            .orElseGet(() -> mapper.pending(WeeklyReviewSectioner.previousWeekStart(settings.today(owner))));
    }

    /**
     * Builds the previous complete week's review of {@code today} (the owner's local date) unless a non-failed row
     * already exists — idempotent, one review per week. Returns the stored row, or empty when nothing was built.
     */
    public Optional<PenzWeeklyReviewEntity> buildIfMissing(UUID owner, LocalDate today, Instant now) {
        LocalDate weekStart = WeeklyReviewSectioner.previousWeekStart(today);
        Optional<PenzWeeklyReviewEntity> existing = store.find(owner, weekStart);
        if (existing.isPresent() && !PenzWeeklyReviewEntity.STATUS_FAILED.equals(existing.get().getStatus())) {
            return Optional.empty();
        }
        return build(owner, weekStart, today, now);
    }

    /**
     * Builds and stores the owner's review of the week starting {@code weekStart}, holdings as of {@code today};
     * empty (nothing stored) when the week has no digest row at all.
     */
    public Optional<PenzWeeklyReviewEntity> build(UUID owner, LocalDate weekStart, LocalDate today, Instant now) {
        List<WeeklySection> sections;
        List<NewsHolding> holdings;
        try {
            List<PenzDigestEntity> week = digests
                .findByCreatedByAndDigestDateBetweenAndDeletedFalseOrderByDigestDateAsc(owner, weekStart,
                    weekStart.plusDays(6));
            if (week.isEmpty()) {
                return Optional.empty(); // the week's digests do not exist (yet): leave it pending
            }
            List<PenzPositionView> positions = portfolio.positions(owner, today);
            holdings = positions.stream().map(PenzWeeklyReviewService::holding).toList();
            Map<LocalDate, List<PenzDigestItemJson>> byDay = new LinkedHashMap<>();
            for (PenzDigestEntity d : week) {
                byDay.put(d.getDigestDate(), d.getItems());
            }
            List<PenzDigestItemJson> items = WeeklyReviewSectioner.dedupe(byDay, weekStart);
            sections = WeeklyReviewSectioner.sections(items, holdings, coverage(owner, today));
        } catch (RuntimeException e) {
            log.warn("Penz weekly review build failed for owner {} week {}: {}", owner, weekStart,
                e.getClass().getSimpleName());
            return Optional.of(store.replace(owner, weekStart, PenzWeeklyReviewEntity.STATUS_FAILED, List.of(), now));
        }
        if (sections.stream().allMatch(WeeklySection::quiet)) {
            List<PenzWeeklySectionJson> quiet = sections.stream().map(WeeklyReviewAssembler::quiet).toList();
            return Optional.of(store.replace(owner, weekStart, PenzWeeklyReviewEntity.STATUS_QUIET, quiet, now));
        }
        PenzWeeklyReviewLlm model = llm.getIfAvailable();
        String raw = model == null ? null
            : model.narrate(WeeklyReviewPrompt.SYSTEM_PROMPT, WeeklyReviewPrompt.userMessage(sections)).orElse(null);
        boolean answered = WeeklyReviewAssembler.readable(raw);
        WeeklyReviewAssembler.Assembly assembly = WeeklyReviewAssembler.assemble(sections, holdings, raw);
        logRejections(owner, weekStart, answered, assembly);
        // a configured model that gave no usable answer is a passing outage: failed (fallback shown), retried next run
        String status = model != null && !answered
            ? PenzWeeklyReviewEntity.STATUS_FAILED : PenzWeeklyReviewEntity.STATUS_READY;
        return Optional.of(store.replace(owner, weekStart, status, assembly.sections(), now));
    }

    /** The long sleeve's coverage months; null when unknown or when computing it failed (never fails the review). */
    private Integer coverage(UUID owner, LocalDate today) {
        try {
            return portfolio.longCoverageMonths(owner, today);
        } catch (RuntimeException e) {
            log.warn("Penz weekly review coverage unavailable for owner {}: {}", owner, e.getClass().getSimpleName());
            return null;
        }
    }

    private static NewsHolding holding(PenzPositionView p) {
        return new NewsHolding(p.holdingId(), p.name(), p.symbol(), p.currency(), p.assetType(), p.sleeve(),
            p.newsTerms());
    }

    private static void logRejections(UUID owner, LocalDate weekStart, boolean answered,
                                      WeeklyReviewAssembler.Assembly a) {
        Map<String, List<DigestViolation.Rule>> rules = new LinkedHashMap<>();
        a.rejected().forEach((sleeve, v) -> rules.put(sleeve, v.stream().map(DigestViolation::rule).distinct().toList()));
        Map<String, String> narratedBy = new LinkedHashMap<>();
        a.sections().forEach(s -> narratedBy.put(s.sleeve(), s.narratedBy()));
        log.info("Penz weekly review for owner {} week {}: model answered={}, narratedBy={}, rejected={}", owner,
            weekStart, answered, narratedBy, rules);
    }
}
