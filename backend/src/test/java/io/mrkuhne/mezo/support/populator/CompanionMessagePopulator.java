package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.InterventionService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/** Test data factory for {@code companion_message} rows (companion-feed). */
@TestComponent
@RequiredArgsConstructor
public class CompanionMessagePopulator {

    private final CompanionMessageRepository companionMessageRepository;

    /** JPA-managed shared EntityManager — only {@link #rawInsertKind} needs it, for a native
     *  insert that reaches the DB CHECK directly; field-injected {@code @PersistenceContext} is
     *  the house exception to constructor DI (see {@code ResetDatabase}/{@code FlagLogPopulator}). */
    @PersistenceContext
    private EntityManager em;

    public CompanionMessageEntity createMessage(
            UUID owner, LocalDate date, String kind, String eyebrow, List<String> body) {
        return createMessage(owner, date, kind, eyebrow, body, Instant.now());
    }

    /** Explicit {@code generatedAt} — needed by callers (e.g. AnchorResolverIT's event-kind
     *  anchor tests) that assert on the row's OWN generation minute and so cannot tolerate
     *  {@link Instant#now()}'s wall-clock nondeterminism. */
    public CompanionMessageEntity createMessage(
            UUID owner, LocalDate date, String kind, String eyebrow, List<String> body, Instant generatedAt) {
        CompanionMessageEntity entity = new CompanionMessageEntity();
        entity.setCreatedBy(owner);
        entity.setMessageDate(date);
        entity.setKind(kind);
        entity.setContent(new CompanionMessageEnvelope(eyebrow, body, List.of()));
        entity.setGeneratedAt(generatedAt);
        return companionMessageRepository.saveAndFlush(entity);
    }

    /** W5.2 intervention card (bd mezo-b3pp.19) — kind + envelope interventionKey in one shot. */
    public CompanionMessageEntity createIntervention(
            UUID owner, LocalDate date, String interventionKey, String text, Instant generatedAt) {
        CompanionMessageEntity entity = new CompanionMessageEntity();
        entity.setCreatedBy(owner);
        entity.setMessageDate(date);
        entity.setKind(CompanionMessageEntity.KIND_INTERVENTION);
        entity.setContent(new CompanionMessageEnvelope(InterventionService.EYEBROW, List.of(text), List.of(), interventionKey));
        entity.setGeneratedAt(generatedAt);
        return companionMessageRepository.saveAndFlush(entity);
    }

    /** S3 setup card (bd mezo-d58h.3) — kind + envelope setupKey in one shot. */
    public CompanionMessageEntity createSetup(
            UUID owner, LocalDate date, String setupKey, String eyebrow, List<String> body, Instant generatedAt) {
        CompanionMessageEntity entity = new CompanionMessageEntity();
        entity.setCreatedBy(owner);
        entity.setMessageDate(date);
        entity.setKind(CompanionMessageEntity.KIND_SETUP);
        entity.setContent(new CompanionMessageEnvelope(eyebrow, body, List.of(), null, setupKey));
        entity.setGeneratedAt(generatedAt);
        return companionMessageRepository.saveAndFlush(entity);
    }

    /** The CURRENT advice-card shape — the same one {@link
     *  io.mrkuhne.mezo.feature.proactive.service.AdviceCardService} actually writes via the 7-arg
     *  {@code CompanionMessageEnvelope.advice(...)} overload: an empty (non-null) {@code actions}
     *  list and a null {@code applied} stamp. Delegates to {@link #createAdviceWithActions} with
     *  {@code List.of(), null} so there is one construction site. Use this for "a normal advice
     *  card" in any test that isn't specifically about the pre-S5 legacy shape — see {@link
     *  #createLegacyAdvice} for that one. */
    public CompanionMessageEntity createAdvice(
            UUID owner, LocalDate date, String adviceKey, String interventionKey, String eyebrow,
            String prose, List<String> facts, List<String> suggestions, Instant generatedAt) {
        return createAdviceWithActions(owner, date, adviceKey, interventionKey, eyebrow, prose,
            facts, suggestions, List.of(), null, generatedAt);
    }

    /** The PRE-S5 legacy advice-card shape — simulates a row written before this slice existed,
     *  whose jsonb literally has no {@code actions}/{@code applied} keys, by passing null for
     *  both (a null actions list round-trips through jsonb as null, not the {@code []} an empty
     *  list would produce). This is the fixture that proves the two trailing components are
     *  jsonb-safe to ADD: old rows deserialize them to null rather than failing. Use only for
     *  legacy-row tests — every other caller wanting "an advice card" should use {@link
     *  #createAdvice}, which matches what production writes today. */
    public CompanionMessageEntity createLegacyAdvice(
            UUID owner, LocalDate date, String adviceKey, String interventionKey, String eyebrow,
            String prose, List<String> facts, List<String> suggestions, Instant generatedAt) {
        return createAdviceWithActions(owner, date, adviceKey, interventionKey, eyebrow, prose,
            facts, suggestions, null, null, generatedAt);
    }

    /** S5 advice card (bd mezo-d58h.5) — same shape as {@link #createAdvice} plus the mutation-set
     *  {@code actions} and an optional {@code applied} stamp, so a test can seed an already-applied
     *  card. Builds the envelope through the canonical constructor (not the {@code advice(...)}
     *  factory) because only the canonical constructor accepts a non-null {@code applied}.
     *  {@code actions} is passed through as-is (null stays null) rather than defensively copied,
     *  so callers can deliberately seed the null pre-S5 shape as well as a real action list. */
    public CompanionMessageEntity createAdviceWithActions(
            UUID owner, LocalDate date, String adviceKey, String interventionKey, String eyebrow,
            String prose, List<String> facts, List<String> suggestions,
            List<CompanionMessageEnvelope.Action> actions, CompanionMessageEnvelope.Applied applied,
            Instant generatedAt) {
        CompanionMessageEntity entity = new CompanionMessageEntity();
        entity.setCreatedBy(owner);
        entity.setMessageDate(date);
        entity.setKind(CompanionMessageEntity.KIND_ADVICE);
        entity.setContent(new CompanionMessageEnvelope(eyebrow, List.of(prose), List.of(),
            interventionKey, null, adviceKey, List.copyOf(facts), List.copyOf(suggestions),
            actions == null ? null : List.copyOf(actions), applied));
        entity.setGeneratedAt(generatedAt);
        return companionMessageRepository.saveAndFlush(entity);
    }

    /** Inserts natively, so an unknown kind reaches the DB CHECK instead of being stopped by
     *  the entity's own {@code @NotNull}/length constraints — the {@code FlagLogPopulator.rawInsert}
     *  idiom, pinning that {@code ck_companion_message_kind} really lives in the schema. */
    @Transactional
    public void rawInsertKind(UUID owner, LocalDate date, String kind) {
        em.createNativeQuery(
                "insert into companion_message (created_by, message_date, kind, content, generated_at) "
                + "values (:owner, :date, :kind, '{}'::jsonb, now())")
            .setParameter("owner", owner).setParameter("date", date).setParameter("kind", kind)
            .executeUpdate();
        em.flush();
    }
}
