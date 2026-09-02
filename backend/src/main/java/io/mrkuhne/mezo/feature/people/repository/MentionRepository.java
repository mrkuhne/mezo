package io.mrkuhne.mezo.feature.people.repository;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Mention orders by {@code ts} (timestamptz), not the {@code OwnedRepository} {@code date} field. */
public interface MentionRepository extends JpaRepository<MentionEntity, UUID> {

    List<MentionEntity> findAllByCreatedByAndDeletedFalseOrderByTsDesc(UUID createdBy);

    /** mezo-cc6x: a hangulat-számítás bemenete PROJEKCIÓKÉNT — a chat-pillanatkép minden
     *  beszélgetési körben újraolvassa, és a négy használt mezőn kívül semmit nem néz meg.
     *  {@code ts} szerint csökkenő, ahogy a hívók feltételezik (a lista első eleme a legfrissebb).
     *  A {@code deleted = false} szűrő öv-és-nadrágtartó a {@code @SQLRestriction} mellett, a ház
     *  szokása szerint.
     *
     *  <p>Szándékosan NINCS időablak: a hangulat-ív a nyolc legutóbbi olyan hetet tartja meg,
     *  amelyikben volt adat — hézagos történetnél ez a nyolc olvasat tetszőlegesen régre nyúlhat,
     *  egy ablak tehát olvasatokat vágna le és az irányt is átbillenthetné; a {@code lastMentionAt}
     *  pedig mindenkori maximum, amin a chat-blokk rendezése áll, és egy ablakkal egy régen
     *  említett személy tévesen „sosem említett"-ként csúszna a lista végére. */
    @Query("""
        select new io.mrkuhne.mezo.feature.people.repository.MentionSignal(
            m.personId, m.ts, m.tone, m.intensity)
        from MentionEntity m
        where m.createdBy = :userId and m.deleted = false
        order by m.ts desc
        """)
    List<MentionSignal> findSignals(@Param("userId") UUID userId);

    /** Ownership gate for the mention itself; person-scope for the 404 is checked by the caller. */
    Optional<MentionEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** mezo-d20.7.8: mentions inside a half-open {@code [from, to)} instant window — the weekly
     *  review's gather input ({@code WeeklyReviewContextSources}), which aggregates them to a
     *  per-person COUNT and never reads the excerpt. Half-open for the same boundary reason
     *  {@code DecisionEntryRepository}'s windowed finder carries. */
    List<MentionEntity> findByCreatedByAndTsGreaterThanEqualAndTsLessThanAndDeletedFalse(
        UUID createdBy, Instant from, Instant to);

    /** Dedup-ellenőrzés az automata úthoz — NATÍV, mert a soft-deleted (✕-szel visszavont) sort is
     *  látni kell: a partial unique index (is_deleted=false) a visszavont sort már nem védi, és a
     *  forrás újramentése különben feltámasztaná, amit a user kifejezetten eltüntetett. */
    @Query(value = "select exists(select 1 from mention where created_by = :userId and person_id = :personId"
            + " and source_ref_kind = :kind and source_ref_id = :refId)", nativeQuery = true)
    boolean existsSourceRefIncludingDeleted(@Param("userId") UUID userId, @Param("personId") UUID personId,
            @Param("kind") String kind, @Param("refId") UUID refId);
}
