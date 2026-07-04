package io.mrkuhne.mezo.feature.people.repository;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Person is a date-less owned aggregate — {@code JpaRepository} + bespoke finders, not
 * {@code OwnedRepository} (whose {@code findAllOwned} orders by a {@code date} field this
 * table lacks; the {@code goal} precedent).
 */
public interface PersonRepository extends JpaRepository<PersonEntity, UUID> {

    List<PersonEntity> findAllByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PersonEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
