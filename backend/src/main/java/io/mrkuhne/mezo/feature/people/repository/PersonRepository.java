package io.mrkuhne.mezo.feature.people.repository;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Person is a date-less owned aggregate — {@code JpaRepository} + bespoke finders, not
 * {@code OwnedRepository} (whose {@code findAllOwned} orders by a {@code date} field this
 * table lacks; the {@code goal} precedent).
 */
public interface PersonRepository extends JpaRepository<PersonEntity, UUID> {

    List<PersonEntity> findAllByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PersonEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** S4 extractor dedup + reject-lista: MINDEN név és alias, a soft-deleted (elvetett jelölt)
     *  sorokét is beleértve — natív, mert a @SQLRestriction a JPQL-utakat szűri. Az elvetett név
     *  így sosem kerül újra javaslatba. */
    @Query(value = "select name from person where created_by = :userId"
            + " union all select unnest(aliases) from person where created_by = :userId",
        nativeQuery = true)
    List<String> findAllNamesAndAliasesIncludingDeleted(@Param("userId") UUID userId);
}
