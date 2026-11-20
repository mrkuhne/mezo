package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzDigestResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzNewsArticleEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzQuoteEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzDigestMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzNewsArticleRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzPortfolioService.PenzPositionView;
import io.mrkuhne.mezo.feature.penz.service.news.DigestAssembler;
import io.mrkuhne.mezo.feature.penz.service.news.DigestFigures;
import io.mrkuhne.mezo.feature.penz.service.news.DigestKind;
import io.mrkuhne.mezo.feature.penz.service.news.DigestPrompt;
import io.mrkuhne.mezo.feature.penz.service.news.DigestStory;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation;
import io.mrkuhne.mezo.feature.penz.service.news.NewsArticle;
import io.mrkuhne.mezo.feature.penz.service.news.NewsHolding;
import io.mrkuhne.mezo.feature.penz.service.news.NewsMatcher;
import io.mrkuhne.mezo.feature.penz.service.news.Story;
import io.mrkuhne.mezo.feature.penz.service.news.StoryClusterer;
import io.mrkuhne.mezo.feature.penz.service.news.StoryKey;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Builds and reads the owner's daily news digest (Boop Pénz L6, mezo-r36n9.104, build notes §3.2–3.8).
 *
 * <p>{@link #build}: his positions (cached quotes — the caller refreshes first) → the deterministic match over the
 * last 36 h of stored articles → stories → the figures per story, computed here from his own positions and never by
 * the model:
 * <ul>
 *   <li><b>holding</b>: that holding's {@code priceMoveHufMinor} (price move since the previous close, at the previous
 *       FX rate), its {@code changePct} and its HUF value;</li>
 *   <li><b>fx</b>: Σ {@code fxMoveHufMinor} over his non-HUF holdings; the % is the pair of the currency he holds the
 *       most of (by HUF value) — with several currencies one pair stands for all, the forint figure still sums
 *       every one;</li>
 *   <li><b>rates</b>: 0 with the fixed note (a rate decision does not move a held bond's price here).</li>
 * </ul>
 * Then ≤ 2 article bodies per story, ONE narration call outside any transaction ({@link PenzDigestLlm}; absent,
 * refused or failed → every story gets fallback copy), the validator gate ({@link DigestAssembler}), and one short
 * write ({@link PenzDigestStore}): {@code ready} with items, {@code quiet} with none, {@code failed} when the build
 * itself broke. Rejections are logged by story id and rule only — never prose, titles or bodies.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PenzDigestService {

    private final PenzPortfolioService portfolio;
    private final PenzQuoteService quotes;
    private final PenzNewsArticleRepository articles;
    private final PenzNewsClient news;
    private final PenzDigestStore store;
    private final PenzProviderHealth health;
    private final PenzSettingsService settings;
    private final PenzDigestMapper mapper;
    private final ObjectProvider<PenzDigestLlm> llm;
    private final ObjectProvider<Clock> clock;

    /** The owner's digest for {@code date} (null = his today); {@code pending} when it was not built yet. */
    public PenzDigestResponse get(UUID owner, LocalDate date) {
        LocalDate d = date == null ? settings.today(owner) : date;
        boolean newsHealthy = !health.allFailing(PenzProviderHealth.KIND_NEWS);
        return store.find(owner, d).map(e -> mapper.digest(e, newsHealthy)).orElseGet(() -> mapper.pending(d,
            newsHealthy));
    }

    /** {@link #build(UUID, LocalDate, Instant)} at the current instant. */
    public PenzDigestEntity build(UUID owner, LocalDate date) {
        return build(owner, date, Instant.now(clock.getIfAvailable(Clock::systemUTC)));
    }

    /** Builds and stores the owner's digest for {@code date}, matching articles in the 36 h before {@code now}. */
    public PenzDigestEntity build(UUID owner, LocalDate date, Instant now) {
        List<DigestStory> stories;
        LocalDate pricesAsOf;
        List<NewsHolding> holdings;
        try {
            List<PenzPositionView> positions = portfolio.positions(owner, date);
            pricesAsOf = pricesAsOf(positions);
            holdings = positions.stream().map(PenzDigestService::holding).toList();
            stories = stories(positions, holdings, now);
        } catch (RuntimeException e) {
            log.warn("Penz digest build failed for owner {} on {}: {}", owner, date, e.getClass().getSimpleName());
            return store.replace(owner, date, PenzDigestEntity.STATUS_FAILED, List.of(), now, null);
        }
        if (stories.isEmpty()) {
            return store.replace(owner, date, PenzDigestEntity.STATUS_QUIET, List.of(), now, pricesAsOf);
        }
        String raw = narrate(stories);
        DigestAssembler.Assembly assembly = DigestAssembler.assembleWithReport(stories, holdings, raw);
        logRejections(owner, stories.size(), raw != null, assembly);
        String status = assembly.items().isEmpty() ? PenzDigestEntity.STATUS_QUIET : PenzDigestEntity.STATUS_READY;
        return store.replace(owner, date, status, assembly.items(), now, pricesAsOf);
    }

    private List<DigestStory> stories(List<PenzPositionView> positions, List<NewsHolding> holdings, Instant now) {
        if (holdings.isEmpty()) {
            return List.of();
        }
        List<PenzNewsArticleEntity> rows =
            articles.findByPublishedAtGreaterThanEqualOrderByPublishedAtDesc(now.minus(NewsMatcher.WINDOW));
        Map<String, String> sourceKeyByUrl = new HashMap<>();
        List<NewsArticle> recent = new ArrayList<>();
        for (PenzNewsArticleEntity r : rows) {
            sourceKeyByUrl.put(r.getUrl(), r.getSourceKey());
            recent.add(new NewsArticle(r.getUrl(), r.getSourceName(), r.getTitle(), r.getSummary(),
                r.getPublishedAt()));
        }
        List<Story> clustered = StoryClusterer.cluster(NewsMatcher.match(recent, holdings, now));
        if (clustered.isEmpty()) {
            return List.of();
        }
        Map<UUID, PenzPositionView> byId = positions.stream()
            .collect(Collectors.toMap(PenzPositionView::holdingId, Function.identity(), (a, b) -> a));
        Map<String, String> bodies = news.bodies(clustered.stream().map(Story::articles).toList(), sourceKeyByUrl);
        List<DigestStory> out = new ArrayList<>();
        for (Story s : clustered) {
            Map<String, String> storyBodies = new LinkedHashMap<>();
            s.articles().stream().filter(a -> bodies.containsKey(a.url()))
                .forEach(a -> storyBodies.put(a.url(), bodies.get(a.url())));
            PenzPositionView p = s.key().kind() == DigestKind.HOLDING ? byId.get(s.key().holdingId()) : null;
            Set<String> linkable = new LinkedHashSet<>();
            s.articles().stream().filter(a -> news.linkable(a.url(), sourceKeyByUrl.get(a.url())))
                .forEach(a -> linkable.add(a.url()));
            out.add(new DigestStory(s, p == null ? null : p.name(), figures(s.key(), p, positions), storyBodies,
                linkable));
        }
        return out;
    }

    /** The backend-computed figures of one story (see the class doc). */
    DigestFigures figures(StoryKey key, PenzPositionView holding, List<PenzPositionView> positions) {
        return switch (key.kind()) {
            case HOLDING -> new DigestFigures(DigestKind.HOLDING, holding.sleeve(),
                holding.priced() ? holding.priceMoveHufMinor() : 0L,
                holding.priced() ? holding.changePct() : null, holding.valueHufMinor());
            case FX -> {
                List<PenzPositionView> foreign = positions.stream()
                    .filter(p -> p.currency() != null && !PenzFxService.HUF.equals(p.currency())).toList();
                long effect = foreign.stream().mapToLong(PenzPositionView::fxMoveHufMinor).sum();
                yield DigestFigures.fx(effect, pairChangePct(foreign));
            }
            case RATES -> new DigestFigures(DigestKind.RATES, null, 0L, null, null);
        };
    }

    /** The % move of the pair of the currency he holds the most of (by HUF value); null when unknown. */
    private BigDecimal pairChangePct(List<PenzPositionView> foreign) {
        Map<String, Long> exposure = new HashMap<>();
        foreign.forEach(p -> exposure.merge(p.currency(), Math.abs(p.valueHufMinor()), Long::sum));
        String currency = exposure.entrySet().stream()
            .max(Map.Entry.<String, Long>comparingByValue().thenComparing(Map.Entry.comparingByKey()))
            .map(Map.Entry::getKey).orElse(null);
        if (currency == null) {
            return null;
        }
        String symbol = PenzQuoteService.fxSymbol(currency);
        PenzQuoteEntity q = quotes.cached(Set.of(symbol)).get(symbol);
        if (q == null || q.getPreviousClose() == null || q.getPreviousClose().signum() == 0) {
            return null;
        }
        return q.getPrice().subtract(q.getPreviousClose()).multiply(BigDecimal.valueOf(100))
            .divide(q.getPreviousClose(), 2, RoundingMode.HALF_UP);
    }

    /** The newest quote date behind his priced holdings; null when none is quoted. */
    private LocalDate pricesAsOf(List<PenzPositionView> positions) {
        Set<String> symbols = new LinkedHashSet<>();
        positions.stream().map(PenzPositionView::symbol).filter(Objects::nonNull).forEach(symbols::add);
        if (symbols.isEmpty()) {
            return null;
        }
        return quotes.cached(symbols).values().stream().map(PenzQuoteEntity::getAsOf).filter(Objects::nonNull)
            .max(Comparator.naturalOrder()).orElse(null);
    }

    private String narrate(List<DigestStory> stories) {
        PenzDigestLlm model = llm.getIfAvailable();
        if (model == null) {
            return null;
        }
        return model.narrate(DigestPrompt.SYSTEM_PROMPT, DigestPrompt.userMessage(stories)).orElse(null);
    }

    private static NewsHolding holding(PenzPositionView p) {
        return new NewsHolding(p.holdingId(), p.name(), p.symbol(), p.currency(), p.assetType(), p.sleeve(),
            p.newsTerms());
    }

    private static void logRejections(UUID owner, int stories, boolean answered, DigestAssembler.Assembly a) {
        long fallback = a.items().stream()
            .filter(i -> PenzDigestItemJson.NARRATED_BY_FALLBACK.equals(i.narratedBy())).count();
        Map<String, List<DigestViolation.Rule>> rules = new LinkedHashMap<>();
        a.rejected().forEach((id, v) -> rules.put(id, v.stream().map(DigestViolation::rule).distinct().toList()));
        log.info("Penz digest for owner {}: {} stor(ies), model answered={}, {} kept, {} fallback, rejected={}",
            owner, stories, answered, a.items().size(), fallback, rules);
    }
}
