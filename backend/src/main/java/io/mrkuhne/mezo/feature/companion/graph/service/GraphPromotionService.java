package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W2.2 promotion pipelines (bd mezo-b3pp.7, spec §6.2): existing knowledge flows into the graph
 * idempotently. Every write goes through {@link GraphService#upsertNode}, keyed by
 * {@code (createdBy, sourceKind, sourceId)} — re-promotion updates title/meta, never duplicates.
 *
 * <p>Deliberately EXCLUDES {@code knowledge_fact} rows with {@code source='pattern'}: those are the
 * V3.3 shadow of a pattern that already becomes a PATTERN node, so promoting them too would put the
 * same sentence in the graph twice.
 *
 * <p>Callers are (from later slices) async promotion hooks and the nightly reconciler — never a
 * controller: promotion is internal, there is no REST surface for it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphPromotionService {

    public static final String SOURCE_PATTERN = "pattern";
    public static final String SOURCE_FACT = "knowledge_fact";
    public static final String SOURCE_GOAL = "goal";
    /** Emberek S5 (mezo-06o0.4). A companion → people függés már létezik
     *  (PersonExtractionService); a fordított irány TILOS, ezért a people oldal nem tud
     *  a gráfról, és nem is kell tudnia: minden itt dől el. */
    public static final String SOURCE_PERSON = "person";

    private final GraphService graphService;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final GoalRepository goalRepository;
    private final PersonRepository personRepository;
    // ObjectProvider, not a direct dependency: the companion switch can be off while the graph
    // switch is on, so GraphEdgeStructurer's bean may not exist (see its @ConditionalOnProperty).
    private final ObjectProvider<GraphEdgeStructurer> edgeStructurer;
    // Self-injected proxy (ObjectProvider defers resolution, so this is safe despite the
    // apparent circularity). See reconcile()'s javadoc for why it is called through this proxy
    // instead of `this`.
    private final ObjectProvider<GraphPromotionService> self;

    /** Confirmed pattern -> PATTERN node. Empty when the pattern is gone, not this user's, or not confirmed.
     *  Only a genuinely NEW node pays for the LLM edge structurer — re-confirming a pattern is a pure UPSERT.
     *
     *  <p>{@link GraphEdgeStructurer#structureEdges} runs inside THIS method's transaction (see its
     *  javadoc for why it is deliberately not {@code REQUIRES_NEW}): node + edges commit or roll
     *  back together. A DB failure here loses this promotion entirely, but promotion is idempotent
     *  (keyed on {@code (createdBy, sourceKind, sourceId)}), so a later re-confirm or the nightly
     *  reconciler (W2.5) heals it without any special-casing. */
    @Transactional
    public Optional<GraphNodeEntity> promotePattern(UUID userId, UUID patternId) {
        Optional<PatternEntity> found = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
            .filter(p -> PatternEntity.STATUS_CONFIRMED.equals(p.getStatus()));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        PatternEntity pattern = found.get();
        boolean isNew = graphService.findBySource(userId, SOURCE_PATTERN, patternId).isEmpty();
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_PATTERN,
            truncateTitle(pattern.getTitle()), pattern.getMechanism(),
            SOURCE_PATTERN, pattern.getId(), null, patternMeta(pattern));
        // Promotion is now two-way (mezo-b3pp.31): retractPattern archives this node when the
        // user un-confirms. GraphService.upsertNode never touches `status`, so without this line
        // a re-confirmed pattern would upsert into a node that stays `archived` forever and
        // never returns to the traversal — archiving would be a one-way trip. syncGoal has
        // always asserted its own status this way; the other two promoters now match it.
        if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())) {
            node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        }
        if (isNew) {
            GraphEdgeStructurer structurer = edgeStructurer.getIfAvailable();
            if (structurer != null) {
                structurer.structureEdges(userId, node, SOURCE_PATTERN, patternId);
            }
        }
        return Optional.of(node);
    }

    /** Active, prompt-included, non-pattern-sourced knowledge fact -> PREFERENCE node.
     *  Re-promotion REVIVES an archived node (mezo-b3pp.31).
     *
     *  <p>{@code includeInPrompt} is filtered here (mezo-b3pp.30) because it is the user's
     *  kill-switch for EVERY injection channel — the wording is
     *  {@code KnowledgeFactService}'s own, where the same switch already gates the V1.1 facts
     *  block and the V3.3 acknowledgment block — and the graph is one more channel into the SAME
     *  system prompt: {@code GraphPromptAssembler} renders traversed nodes straight into it. A
     *  fact the user opted out of must therefore never become, or stay, an active node. */
    @Transactional
    public Optional<GraphNodeEntity> promoteFact(UUID userId, UUID factId) {
        return knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
            .filter(f -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .filter(KnowledgeFactEntity::isIncludeInPrompt)
            .map(f -> {
                GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_PREFERENCE,
                    truncateTitle(f.getFactText()), f.getFactText(), SOURCE_FACT, f.getId(), null,
                    Map.of("category", f.getCategory(), "source", f.getSource()));
                if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())) {
                    node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
                }
                return node;
            });
    }

    /** Goal -> GOAL node; a goal that is no longer active archives its node (the graph shadows, never forgets). */
    @Transactional
    public Optional<GraphNodeEntity> syncGoal(UUID userId, UUID goalId) {
        Optional<GoalEntity> found = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        GoalEntity goal = found.get();
        boolean active = "active".equals(goal.getStatus());
        if (!active && graphService.findBySource(userId, SOURCE_GOAL, goalId).isEmpty()) {
            return Optional.empty();   // never promoted, never active — nothing to shadow
        }
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
            truncateTitle(goal.getTitle()), goal.getTitle(), SOURCE_GOAL, goal.getId(), null,
            Map.of("status", goal.getStatus()));
        String status = active ? GraphNodeEntity.STATUS_ACTIVE : GraphNodeEntity.STATUS_ARCHIVED;
        if (!status.equals(node.getStatus())) {
            node.setStatus(status);
        }
        return Optional.of(node);
    }

    /**
     * Aktív személy -> PERSON node; minden más állapot (jelölt, archivált) archiválja a node-ját —
     * a {@link #syncGoal} alakja, ugyanazzal a „soha nem felejt, csak leveszi a színpadról"
     * szerződéssel.
     *
     * <p>A jelölt SZÁNDÉKOSAN nem kerül a gráfba: egy éjszakai extraktor-javaslat nem tény, amíg
     * a felhasználó rá nem bólint. Egy soha nem promótált, nem aktív személy tehát no-op (nincs mit
     * árnyékolni), pontosan mint a {@code syncGoal}-nál.
     *
     * <p>{@code summary} = kapcsolat + cadence (spec „Gráf-tükör"), mert ez az, amit a
     * {@code [Összefüggések]} prompt-blokk és a {@link GraphEdgeStructurer} olvas a személyről —
     * a `notes` a felhasználó szabad szövege, oda nem való.
     */
    @Transactional
    public Optional<GraphNodeEntity> syncPerson(UUID userId, UUID personId) {
        Optional<PersonEntity> found = personRepository.findByIdAndCreatedByAndDeletedFalse(personId, userId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        PersonEntity person = found.get();
        boolean active = "active".equals(person.getStatus());
        if (!active && graphService.findBySource(userId, SOURCE_PERSON, personId).isEmpty()) {
            return Optional.empty();   // sosem volt node — nincs mit árnyékolni
        }
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_PERSON,
            truncateTitle(person.getName()), personSummary(person), SOURCE_PERSON, person.getId(),
            null, Map.of("relationship", person.getRelationship(), "status", person.getStatus()));
        String status = active ? GraphNodeEntity.STATUS_ACTIVE : GraphNodeEntity.STATUS_ARCHIVED;
        if (!status.equals(node.getStatus())) {
            node.setStatus(status);
        }
        return Optional.of(node);
    }

    /**
     * The mirror of {@link #promotePattern} (bd mezo-b3pp.31): a pattern that is no longer
     * confirmed must stop asserting itself in the graph. Archives the node rather than deleting
     * it — {@code status='archived'} keeps the row (and with it the
     * {@code (createdBy, sourceKind, sourceId)} anchor), so a later re-confirm revives the SAME
     * node — no duplicate under a new id — while {@code GraphTraversalQuery}'s
     * {@code status = 'active'} filter takes it out of the [Összefüggések] prompt block
     * immediately.
     *
     * <p><b>The node survives; its EDGES don't, necessarily.</b> {@link
     * GraphMaintenanceService}'s nightly {@code decayAndPruneEdges} decays EVERY active edge by
     * {@code graph.decay-factor} regardless of whether either endpoint is archived, and
     * soft-deletes any edge that falls under {@code graph.prune-floor} — at the default
     * {@code decay-factor=0.99}/{@code prune-floor=0.05}, an edge that started around weight 0.3
     * crosses the floor in roughly half a year of nightly decay. And on the later re-confirm,
     * {@link #promotePattern}'s {@code isNew} check is false (the node row never went away), so
     * {@link GraphEdgeStructurer} is deliberately NOT re-run. A node archived long enough for its
     * edges to fully decay away therefore comes back {@code active} but edge-less, and since
     * [Összefüggések] renders purely from edges, contributes nothing to that block until
     * something else rebuilds its edges.
     *
     * <p>Re-checks the pattern's status itself instead of trusting the caller, so
     * {@code PatternService.decide} can publish the retraction event on ANY non-confirm branch
     * without the listener having to reason about which transitions matter.
     *
     * @return the archived node, or empty when the pattern is still confirmed, was never
     *         promoted, or the node is already archived (all no-ops)
     */
    @Transactional
    public Optional<GraphNodeEntity> retractPattern(UUID userId, UUID patternId) {
        boolean stillConfirmed = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
            .filter(p -> PatternEntity.STATUS_CONFIRMED.equals(p.getStatus()))
            .isPresent();
        if (stillConfirmed) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_PATTERN, patternId);
    }

    /** The mirror of {@link #syncGoal} for the DELETE path (bd mezo-b3pp.31). {@code syncGoal}
     *  already demotes a goal that merely stops being active, but a soft-deleted goal is invisible
     *  to it (its finder is {@code ...AndDeletedFalse}), so the delete needs its own retraction. */
    @Transactional
    public Optional<GraphNodeEntity> retractGoal(UUID userId, UUID goalId) {
        boolean stillLive = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).isPresent();
        if (stillLive) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_GOAL, goalId);
    }

    /** A {@link #syncPerson} DELETE-ági tükre, a {@link #retractGoal} mintájára: a soft-deleted
     *  személy láthatatlan a {@code ...AndDeletedFalse} finder számára, ezért a törlésnek saját
     *  visszavonása kell, különben a node örökre aktív marad. Az elvetett jelölt is ide fut
     *  (a reject soft-delete) — annak jellemzően nincs is node-ja, így ez no-op. */
    @Transactional
    public Optional<GraphNodeEntity> retractPerson(UUID userId, UUID personId) {
        boolean stillActive = personRepository.findByIdAndCreatedByAndDeletedFalse(personId, userId)
            .filter(p -> "active".equals(p.getStatus()))
            .isPresent();
        if (stillActive) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_PERSON, personId);
    }

    /** The mirror of {@link #promoteFact} (bd mezo-b3pp.31). A fact stops qualifying two ways:
     *  it is soft-deleted, or the user opts it out ({@code includeInPrompt = false}, mezo-b3pp.30).
     *  No service in main source soft-deletes a {@code knowledge_fact} today, so nothing publishes
     *  a delete-triggered retraction event — the soft-delete half exists only for {@link
     *  #reconcile}'s sweep, ready for the day a delete surface lands. The opt-out half DOES have
     *  a live trigger: {@code KnowledgeFactService.update} publishes an event Task 2 wires to
     *  {@link #syncFact}, so an opt-out takes effect on the next turn rather than waiting for the
     *  nightly sweep. */
    @Transactional
    public Optional<GraphNodeEntity> retractFact(UUID userId, UUID factId) {
        boolean stillLive = knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
            .filter(f -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .filter(KnowledgeFactEntity::isIncludeInPrompt)
            .isPresent();
        if (stillLive) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_FACT, factId);
    }

    /**
     * Promote-or-archive in one call (mezo-b3pp.30) — the {@link #syncGoal} shape, for the one
     * source whose qualifying condition the user can flip back and forth at will.
     *
     * <p>{@link #promoteFact} and {@link #retractFact} each answer only half the question, and a
     * caller reacting to "this fact changed" cannot know which half it needs: the same
     * {@code PUT} that opts a fact out can opt the next one back in. Routing both through here
     * keeps the listener free of that decision and makes the toggle take effect on the next turn
     * rather than at the nightly sweep.
     *
     * @return the promoted or archived node, or empty when there was nothing to do (an opted-out
     *         fact that was never promoted, or a node already in the target state)
     */
    @Transactional
    public Optional<GraphNodeEntity> syncFact(UUID userId, UUID factId) {
        // Calling promoteFact/retractFact on `this` here is correct and deliberate: syncFact is
        // already @Transactional, so the whole promote-or-archive decision belongs in ONE
        // transaction — unlike reconcile()'s per-item proxy calls (see that javadoc for why
        // THOSE must not share one).
        Optional<GraphNodeEntity> promoted = promoteFact(userId, factId);
        return promoted.isPresent() ? promoted : retractFact(userId, factId);
    }

    /** Archive the node behind one source row, if there is one and it is not archived already. */
    private Optional<GraphNodeEntity> archiveBySource(UUID userId, String sourceKind, UUID sourceId) {
        return graphService.findBySource(userId, sourceKind, sourceId)
            .filter(n -> !GraphNodeEntity.STATUS_ARCHIVED.equals(n.getStatus()))
            .map(n -> {
                n.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
                return n;
            });
    }

    /**
     * The nightly sweep (spec §6.2) — everything the write-path hooks could have missed: patterns
     * confirmed before the graph existed, manually created facts (no promote hook), goals whose
     * title drifted since they were last synced, and people whose status changed while the graph
     * listener was off (Task 3). Pure UPSERT (every write is keyed on
     * {@code (createdBy, sourceKind, sourceId)}), so running it every night — or twice in a row —
     * is free of side effects: {@code reconcile(userId)} called back-to-back returns the same
     * count and leaves the same rows. W2.5 wires it into {@code GraphMaintenanceJob}; nothing
     * schedules it in this slice, and it is not exposed over REST.
     *
     * <p>Deliberately reuses {@link #promotePattern}/{@link #promoteFact}/{@link #syncGoal}/
     * {@link #syncPerson} rather than re-deriving their skip rules here: this method fetches
     * confirmed patterns, all (non-deleted) facts, all (non-deleted) goals, and all (non-deleted)
     * people for the user, and lets each promote/sync method's own filter decide whether a given
     * row actually produces a node (unconfirmed patterns are excluded at the query level since the
     * repository already has a status-scoped finder; pattern-sourced facts, opted-out facts
     * (mezo-b3pp.30), never-promoted/inactive goals, and never-promoted candidate/archived people
     * are excluded by {@link #promoteFact}, {@link #syncGoal}, and {@link #syncPerson}
     * respectively).
     *
     * <p><b>Deliberately NOT {@code @Transactional} itself.</b> Each promote/sync call below goes
     * through {@link #self}, the injected proxy, so it runs inside its OWN transaction — the one
     * {@code @Transactional} already puts on {@link #promotePattern}/{@link #promoteFact}/
     * {@link #syncGoal}/{@link #syncPerson}. Calling them on {@code this} instead (ordinary Spring self-invocation)
     * would bypass the proxy entirely: no new transactional advice would apply, and if reconcile
     * itself carried {@code @Transactional}, every promotion in the sweep would silently merge
     * into that one outer transaction. For a large first sweep over a backlog — where every
     * confirmed pattern is a NEW node and therefore pays for a {@link GraphEdgeStructurer} LLM
     * call (cheap-tier, but potentially many calls back-to-back) — that would mean one DB
     * connection held open across the entire sweep, and one bad row rolling back every other
     * promotion that already succeeded. Per-item transactions (via the proxy) keep the sweep safe
     * to interrupt, cheap to retry, and consistent with the fact that each promote/sync method is
     * independently idempotent.
     *
     * <p>Not a single bulk pass either: each row costs its own {@code findBySource} lookup (the
     * new-node check inside {@link #promotePattern}) plus its own upsert, so the sweep is O(rows)
     * round trips rather than one query per entity type — acceptable for a nightly job, but worth
     * knowing before pointing this at a very large backlog.
     *
     * <p>Per-row isolation (mezo-b3pp.32): a single row's promotion/sync failure is caught,
     * logged, and skipped — it does not abort the rest of the sweep for this user. This matters
     * once W2.5's {@code GraphMaintenanceJob} calls this nightly across every user: one corrupt
     * pattern must not silently stop that user's facts, goals, and people from reconciling too.
     *
     * <p>After the four promotion loops, a fifth pass — the COMPLEMENT sweep (mezo-b3pp.31) —
     * walks the user's ACTIVE nodes back to their source row and retracts (archives) every one
     * whose source stopped qualifying. The four loops above only ever see rows that still
     * qualify, so a row that LEFT a qualifying set (a pattern un-confirmed, a goal, fact, or
     * person soft-deleted, or a fact opted out via {@code includeInPrompt = false}, mezo-b3pp.30)
     * is invisible to them and its node would otherwise stay active forever. This
     * is what heals a retraction that happened while the graph switch was off (no listener
     * existed to hear the event), and it is the ONLY path that retracts a soft-deleted
     * {@code knowledge_fact}, since nothing in main source deletes one and so no event is
     * published for it.
     *
     * @return {@link GraphReconcileResult#upserted()} — nodes created or refreshed from a source
     *         row that still qualifies — and {@link GraphReconcileResult#retracted()} — active
     *         nodes archived because their source row no longer qualifies
     */
    public GraphReconcileResult reconcile(UUID userId) {
        GraphPromotionService proxy = self.getObject();
        int count = 0;
        int skipped = 0;
        for (PatternEntity pattern : patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(userId, PatternEntity.STATUS_CONFIRMED)) {
            try {
                count += proxy.promotePattern(userId, pattern.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: pattern {} promotion failed for user {}", pattern.getId(), userId, e);
            }
        }
        for (KnowledgeFactEntity fact : knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)) {
            try {
                count += proxy.promoteFact(userId, fact.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: fact {} promotion failed for user {}", fact.getId(), userId, e);
            }
        }
        for (GoalEntity goal : goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(userId)) {
            try {
                count += proxy.syncGoal(userId, goal.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: goal {} sync failed for user {}", goal.getId(), userId, e);
            }
        }
        for (PersonEntity person : personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            try {
                count += proxy.syncPerson(userId, person.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: person {} sync failed for user {}", person.getId(), userId, e);
            }
        }
        // The COMPLEMENT sweep (mezo-b3pp.31). The four loops above only ever see rows that
        // still qualify — confirmed patterns, non-deleted facts, non-deleted goals, non-deleted
        // people — so a row that LEAVES those sets is invisible to them and its node would stay
        // active forever.
        // This walks the other way round: from the user's active nodes back to their source row,
        // archiving every node whose source stopped qualifying. It is what heals a retraction
        // that happened while the graph switch was off (no listener existed to hear the event).
        // For the soft-delete half of a fact's retraction specifically, this sweep is the ONLY
        // path: nothing in main source deletes a knowledge_fact today, so no event is published
        // for it. The opt-out half is different — KnowledgeFactService.update already publishes
        // a live event routed to syncFact (see retractFact's javadoc), so this sweep is only its
        // fallback/healer, not its only path.
        int retracted = 0;
        for (GraphNodeEntity node : graphService.listActive(userId)) {
            UUID sourceId = node.getSourceId();
            if (sourceId == null) {
                // extractor/quarterly nodes (LifeEventExtractionService/QuarterlyReviewService,
                // via GraphService#createCandidate) never get a sourceId; they own their own
                // lifecycle. The profile node DOES carry one (ProfileAssembler passes userId as
                // sourceId with sourceKind="profile") and is instead caught by the switch's
                // default branch below.
                continue;
            }
            try {
                boolean archived = switch (node.getSourceKind() == null ? "" : node.getSourceKind()) {
                    case SOURCE_PATTERN -> proxy.retractPattern(userId, sourceId).isPresent();
                    case SOURCE_FACT -> proxy.retractFact(userId, sourceId).isPresent();
                    case SOURCE_GOAL -> proxy.retractGoal(userId, sourceId).isPresent();
                    case SOURCE_PERSON -> proxy.retractPerson(userId, sourceId).isPresent();
                    default -> false;
                };
                retracted += archived ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: node {} retraction check failed for user {}", node.getId(), userId, e);
            }
        }
        if (skipped > 0) {
            log.warn("Reconcile skipped {} row(s) for user {} due to per-row failures", skipped, userId);
        }
        return new GraphReconcileResult(count, retracted);
    }

    /** {r, n, direction} — the spec's PATTERN meta envelope; direction is the sign of r, prompt-renderable. */
    private static Map<String, Object> patternMeta(PatternEntity pattern) {
        Map<String, Object> meta = new HashMap<>();
        BigDecimal r = pattern.getR();
        meta.put("r", r == null ? null : r.toPlainString());
        meta.put("n", pattern.getN());
        meta.put("direction", r == null ? null : (r.signum() < 0 ? "negative" : "positive"));
        return meta;
    }

    /** „Élettárs · Napi" — kapcsolat, és ha van, a cadence-címke. */
    private static String personSummary(PersonEntity person) {
        String cadence = person.getContactCadenceLabel();
        return cadence == null || cadence.isBlank()
            ? person.getRelationshipHu()
            : person.getRelationshipHu() + " · " + cadence;
    }

    /** knowledge_node.title is varchar(120); pattern titles (up to 200, LLM-generated hypotheses),
     *  fact texts, and goal titles can all be longer. */
    private static String truncateTitle(String text) {
        return text.length() <= 120 ? text : text.substring(0, 117) + "…";
    }
}
