package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Persistence-only in V1.1 — the pending-inbox finders arrive with the V1.2 extraction flow. */
public interface LearnedFactRepository extends JpaRepository<LearnedFactEntity, UUID> {
}
