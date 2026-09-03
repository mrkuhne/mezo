package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterClaimRepository extends JpaRepository<CharacterClaimEntity, UUID> {

    List<CharacterClaimEntity> findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
            UUID createdBy, UUID dimensionId, String status);

    /** Every ACTIVE claim for an owner, across all dimensions (Karakter spec §6, mezo-1gim.5) —
     *  the konzílium round's "meglévő aktív állítások" context, filtered per expert by dimension. */
    List<CharacterClaimEntity> findByCreatedByAndStatusOrderByConfidenceDesc(UUID createdBy, String status);

    /** Owner-scoped ACTIVE claim lookup for {@code UP}/{@code DOWN}/{@code RETIRE} rulings
     *  (mezo-1gim.5) — an unknown or foreign claim id (another owner's, or already RETIRED)
     *  resolves to empty so {@code ClaimLifecycle} can skip it without throwing. */
    Optional<CharacterClaimEntity> findByIdAndCreatedByAndStatus(UUID id, UUID createdBy, String status);

    /** Owner-scoped claim lookup regardless of status — feedback (mezo-1gim.10) needs to tell
     *  "no such claim" (404) apart from "already retired" (409), unlike the ACTIVE-only finder
     *  above. */
    Optional<CharacterClaimEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
}
