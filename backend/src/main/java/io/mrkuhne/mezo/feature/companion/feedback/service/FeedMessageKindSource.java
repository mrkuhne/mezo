package io.mrkuhne.mezo.feature.companion.feedback.service;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * W4.2's (bd mezo-b3pp.16) port for resolving a {@code feed_message} artifact's
 * {@code companion_message.kind} — that data lives in {@code feature.proactive}, and
 * {@code feature.proactive} ALREADY imports {@code feature.companion} extensively (its generators
 * pull context/facts/patterns). A direct {@code feature.companion → feature.proactive} import would
 * therefore create a brand-new companion↔proactive cycle, which ArchitectureTest's
 * {@code feature_slices_are_cycle_free} (a FreezingArchRule — only the pre-existing frozen cycles
 * are tolerated) would reject.
 *
 * <p>This interface inverts the dependency: it lives in {@code feature.companion} (so
 * {@link FeedbackLearningService} only ever depends on its own slice), and its real implementation
 * ({@code io.mrkuhne.mezo.feature.proactive.service.FeedMessageKindService}) is wired in by Spring
 * at runtime — the only import that crosses the boundary is proactive → companion, which already
 * exists. The {@link io.mrkuhne.mezo.feature.companion.service.PatternImpactSource} precedent.
 */
public interface FeedMessageKindSource {

    /** The feed-slot vocabulary this port speaks, so a companion-side consumer never imports a
     *  proactive ENTITY just to name a kind — the {@code NarrativeNoteSource} idiom. These are
     *  LITERAL mirrors of {@code CompanionMessageEntity.KIND_*} (the owning slice's source of
     *  truth): a constant REFERENCE would be exactly the boundary-crossing import this port
     *  exists to remove, so they are duplicated the same way the entities' {@code @Pattern}
     *  guards duplicate their DB CHECKs. Keep both sides in step when a slot is added. */
    String KIND_MORNING = "morning";
    String KIND_SLEEP = "sleep";
    String KIND_WEIGHT = "weight";
    String KIND_MIDDAY = "midday";
    String KIND_EVENING = "evening";
    String KIND_INTERVENTION = "intervention";
    String KIND_PEOPLE = "people";
    String KIND_SETUP = "setup";
    String KIND_ADVICE = "advice";

    /** {@code (companion_message.id → kind)} for every id in {@code feedMessageIds} that is both a
     *  live {@code companion_message} row AND owned by {@code userId}; an id with no match (a
     *  dangling artifact_id — spec §8.1 names that harmless in a single-user app — or one belonging
     *  to a different user) is simply absent from the map. */
    Map<UUID, String> kindsByIds(UUID userId, Collection<UUID> feedMessageIds);

    /** {@code (companion_message.id → envelope interventionKey)} for every id that is a live,
     *  user-owned intervention-kind row WITH a non-null key; every other id is absent. W5.2's
     *  (bd mezo-b3pp.19) per-intervention rollup join, same dangling-id contract as
     *  {@link #kindsByIds}. */
    Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> feedMessageIds);
}
