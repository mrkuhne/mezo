package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeBreakdownResponse;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.mapper.BreakdownDtoMapper;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Lazy cache-or-generate template breakdown (mezo-bw3y, spec D2/D5): the deterministic envelope is
 * recomputed on every read (cheap pure math); the persisted copy is served only while its numbers
 * still match the fresh run (pantry drift ⇒ regenerate; a recipe edit nulls the cache in
 * {@link RecipeService#update}). Only prose-enriched envelopes are persisted.
 *
 * <p><b>The prose is written in the background</b> (mezo-r36n9.219). The prose v2 prompt takes
 * ~110 s on the cheap tier, the phone gives up after 40 s — so a cache miss answers AT ONCE with the
 * deterministic envelope (contributors included) and {@code prosePending=true}, and hands the model
 * call to {@code applicationTaskExecutor}. The client re-fetches; once the prose is persisted the
 * cache path serves it. Guarantees:
 * <ul>
 *   <li><b>One generation per recipe:</b> an in-flight set dedupes — repeated polls never start a
 *       second model call.</li>
 *   <li><b>Own transactions, none across the model call:</b> a short read tx builds the prompt, the
 *       model runs with no connection held, a short write tx persists.</li>
 *   <li><b>Persist only if the numbers still match</b> a fresh run at write time (an edit or pantry
 *       drift during the call drops the stale prose; the next read starts over).</li>
 *   <li><b>A failure backs off</b> for {@link #FAILURE_BACKOFF} for the same numbers: the reads then
 *       answer {@code prosePending=false} (the card stays prose-less, the client stops polling) and
 *       no model call is retried per poll; after the back-off the prose self-heals on a later read.</li>
 * </ul>
 * State is in-memory: a pod restart forgets in-flight work, and the next read simply schedules again.
 */
@Slf4j
@Service
public class RecipeBreakdownService {

    /** How long a failed prose call keeps a recipe (with the same value) from being retried. */
    static final Duration FAILURE_BACKOFF = Duration.ofMinutes(10);

    private final RecipeRepository repository;
    private final RecipeService recipeService;
    private final MealScoringService scoringService;
    private final ObjectProvider<RecipeBreakdownProseService> prose;
    private final TransactionTemplate readTx;
    private final TransactionTemplate writeTx;
    private final Executor executor;

    private final Set<UUID> inFlight = ConcurrentHashMap.newKeySet();
    private final Map<UUID, Failure> failures = new ConcurrentHashMap<>();

    /** A failed prose call: when, and for which envelope value (other numbers ⇒ retry at once). */
    private record Failure(Instant at, BigDecimal value) {
    }

    /** What one read of the recipe yields: either a finished answer, or the fresh prose-less envelope. */
    private record Read(RecipeBreakdownResponse served, MealBreakdownJson fresh) {
    }

    /** The prompt + the envelope it narrates, built inside the background read tx. */
    private record Prepared(RecipeBreakdownProseService svc, RecipeBreakdownProseService.Prompt prompt,
                            MealBreakdownJson envelope) {
    }

    public RecipeBreakdownService(RecipeRepository repository, RecipeService recipeService,
                                  MealScoringService scoringService,
                                  ObjectProvider<RecipeBreakdownProseService> prose,
                                  PlatformTransactionManager transactionManager,
                                  @Qualifier("applicationTaskExecutor") Executor executor) {
        this.repository = repository;
        this.recipeService = recipeService;
        this.scoringService = scoringService;
        this.prose = prose;
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
        this.writeTx = new TransactionTemplate(transactionManager);
        this.writeTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.executor = executor;
    }

    public RecipeBreakdownResponse getOrGenerate(UUID userId, UUID id) {
        Read read = readTx.execute(status -> read(userId, id));
        if (read.served() != null) {
            return read.served();
        }
        boolean pending = schedule(userId, id, read.fresh());
        return response(read.fresh(), List.of(), pending); // deterministic, unpersisted (spec D5/D6)
    }

    private Read read(UUID userId, UUID id) {
        RecipeEntity recipe = load(userId, id);
        List<MealScoringService.ScoredLine> lines = lines(recipe);
        MealBreakdownJson fresh = scoringService.recipeTemplateBreakdown(recipe.getCategory(), lines,
            recipe.getRole());
        if (fresh == null) { // no kcal — pending-sparkle territory, nothing to explain
            return new Read(response(null, List.of(), false), null);
        }
        if (matches(recipe.getBreakdown(), fresh)) {
            // „Honnan jön" rows (mezo-r36n9.199) are recomputed on every read and overlaid on the
            // served envelope — never persisted, so they can't go stale.
            return new Read(response(RecipeContributors.attach(recipe.getBreakdown(), lines),
                recipe.getFitsFor() == null ? List.of() : recipe.getFitsFor(), false), null);
        }
        return new Read(null, RecipeContributors.attach(fresh, lines));
    }

    /** Starts the background prose for {@code id} unless one runs already; true when prose is on its way. */
    private boolean schedule(UUID userId, UUID id, MealBreakdownJson fresh) {
        RecipeBreakdownProseService svc = prose.getIfAvailable();
        if (svc == null || !svc.available()) {
            return false; // flag or companion off — the card stays prose-less for good
        }
        Failure failed = failures.get(id);
        if (failed != null && failed.value().compareTo(fresh.value()) == 0
            && failed.at().plus(FAILURE_BACKOFF).isAfter(Instant.now())) {
            return false;
        }
        if (!inFlight.add(id)) {
            return true; // already being written — a poll, not a second model call
        }
        try {
            executor.execute(() -> generate(userId, id));
            return true;
        } catch (RejectedExecutionException e) {
            inFlight.remove(id);
            log.warn("Recipe breakdown prose: executor rejected {} — serving prose-less", id, e);
            return false;
        }
    }

    /** The background half: read tx (prompt) → model call (no tx) → write tx (persist if still true). */
    private void generate(UUID userId, UUID id) {
        BigDecimal value = null;
        try {
            Prepared prepared = LlmActorContext.runAsCaptured(userId,
                () -> readTx.execute(status -> prepare(userId, id)));
            if (prepared == null) {
                return;
            }
            value = prepared.envelope().value();
            RecipeBreakdownProseService.Enriched enriched = LlmActorContext.runAsCaptured(userId,
                () -> prepared.svc().complete(id, prepared.prompt(), prepared.envelope()));
            if (enriched == null) {
                failures.put(id, new Failure(Instant.now(), value));
                return;
            }
            writeTx.executeWithoutResult(status -> persist(userId, id, enriched));
            failures.remove(id);
        } catch (RuntimeException e) {
            log.warn("Recipe breakdown prose: background generation failed for {}", id, e);
            if (value != null) {
                failures.put(id, new Failure(Instant.now(), value));
            }
        } finally {
            inFlight.remove(id);
        }
    }

    /** Null when there is nothing to write: recipe gone, no kcal, already cached, or no model. */
    private Prepared prepare(UUID userId, UUID id) {
        RecipeEntity recipe = repository.findByIdAndCreatedByAndDeletedFalse(id, userId).orElse(null);
        if (recipe == null) {
            return null;
        }
        List<MealScoringService.ScoredLine> lines = lines(recipe);
        MealBreakdownJson fresh = scoringService.recipeTemplateBreakdown(recipe.getCategory(), lines,
            recipe.getRole());
        if (fresh == null || matches(recipe.getBreakdown(), fresh)) {
            return null; // a racing generation already persisted it
        }
        RecipeBreakdownProseService svc = prose.getIfAvailable();
        if (svc == null) {
            return null;
        }
        MealBreakdownJson withSources = RecipeContributors.attach(fresh, lines);
        RecipeBreakdownProseService.Prompt prompt = svc.prepare(recipe, withSources);
        return prompt == null ? null : new Prepared(svc, prompt, withSources);
    }

    private void persist(UUID userId, UUID id, RecipeBreakdownProseService.Enriched enriched) {
        RecipeEntity recipe = repository.findByIdAndCreatedByAndDeletedFalse(id, userId).orElse(null);
        if (recipe == null) {
            return;
        }
        MealBreakdownJson fresh = fresh(recipe);
        if (fresh == null || !numbersMatch(enriched.envelope(), fresh)) {
            log.info("Recipe breakdown prose for {} dropped — the numbers moved during generation", id);
            return;
        }
        recipe.setBreakdown(enriched.envelope()); // dirty-checked; flush on tx commit
        recipe.setFitsFor(enriched.fitsFor());
    }

    private RecipeEntity load(UUID userId, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private List<MealScoringService.ScoredLine> lines(RecipeEntity recipe) {
        return recipeService.fitLines(recipe, recipeService.pantryByIdFor(List.of(recipe)));
    }

    /**
     * Portion budget keyed on the canonical {@code category}, not the free-form {@code slot} label
     * (mezo-7797). Scored under the recipe's own stored role (mezo-uavr) — the same rubric overlay the
     * fit badge uses, so hero ≡ envelope holds for pre/post-workout templates too. A role edit
     * typically also moves these numbers, but the guarantee that a role edit is re-evaluated is the
     * blanket cache null in {@code RecipeService.update} (the macro score is clamped at 0, and
     * {@link #matches} never compares prose).
     */
    private MealBreakdownJson fresh(RecipeEntity recipe) {
        return scoringService.recipeTemplateBreakdown(recipe.getCategory(), lines(recipe), recipe.getRole());
    }

    /** Cache valid iff the persisted prose is the current prompt generation AND its numbers equal the
     *  freshly computed ones (value + per-dim). */
    private static boolean matches(MealBreakdownJson stored, MealBreakdownJson fresh) {
        return stored != null && stored.proseVersion() != null
            && stored.proseVersion() >= RecipeBreakdownProseService.PROSE_VERSION
            && numbersMatch(stored, fresh);
    }

    private static boolean numbersMatch(MealBreakdownJson stored, MealBreakdownJson fresh) {
        if (stored.value() == null || fresh.value() == null
            || stored.value().compareTo(fresh.value()) != 0
            || stored.dimensions() == null
            || stored.dimensions().size() != fresh.dimensions().size()) {
            return false;
        }
        for (int i = 0; i < fresh.dimensions().size(); i++) {
            MealBreakdownJson.Dimension s = stored.dimensions().get(i);
            MealBreakdownJson.Dimension f = fresh.dimensions().get(i);
            if (!Objects.equals(s.id(), f.id())
                || s.score() == null || s.weight() == null
                || s.score().compareTo(f.score()) != 0
                || s.weight().compareTo(f.weight()) != 0) {
                return false;
            }
        }
        return true;
    }

    private RecipeBreakdownResponse response(MealBreakdownJson envelope, List<String> fitsFor,
                                             boolean prosePending) {
        return RecipeBreakdownResponse.builder()
            .breakdown(envelope == null ? null : BreakdownDtoMapper.toDto(envelope))
            .fitsFor(fitsFor)
            .prosePending(prosePending)
            .build();
    }
}
