package io.mrkuhne.mezo.feature.people.repository;

import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** S3 (mezo-d6ivw.3) — person_fact olvasók; a dedupe/vétó a NEM törölt (aktív + visszavont) sorokon fut. */
public interface PersonFactRepository extends JpaRepository<PersonFactEntity, UUID> {

    /** MINDEN nem törölt sor (aktív + visszavont) — a dedupe/vétó-ellenőrzés bemenete. */
    List<PersonFactEntity> findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, UUID personId);

    /** A chip-fetch: egy forrás (pl. egy chat-forduló) aktív tényei. */
    List<PersonFactEntity> findByCreatedByAndSourceRefKindAndSourceRefIdAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
        UUID createdBy, String sourceRefKind, String sourceRefId);

    /** A snapshot-blokk: az aktív kör bekapcsolt tényei. */
    List<PersonFactEntity> findByCreatedByAndPersonIdInAndActiveTrueAndIncludeInPromptTrueAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, Collection<UUID> personIds);

    Optional<PersonFactEntity> findByIdAndCreatedByAndPersonIdAndDeletedFalse(
        UUID id, UUID createdBy, UUID personId);
}
