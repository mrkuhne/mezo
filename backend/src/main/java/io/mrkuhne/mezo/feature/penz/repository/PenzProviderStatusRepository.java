package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzProviderStatusEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** One health row per outbound provider (global). */
public interface PenzProviderStatusRepository extends JpaRepository<PenzProviderStatusEntity, UUID> {

    Optional<PenzProviderStatusEntity> findByProviderKey(String providerKey);

    List<PenzProviderStatusEntity> findByKind(String kind);

    /** A successful fetch: the streak resets. */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        insert into penz_provider_status (provider_key, kind, last_success_at, fail_streak)
        values (:key, :kind, now(), 0)
        on conflict (provider_key) do update set kind = excluded.kind, last_success_at = now(), fail_streak = 0,
            updated_at = now()
        """, nativeQuery = true)
    int recordSuccess(@Param("key") String key, @Param("kind") String kind);

    /** A failed fetch: the streak grows by one, the short reason is kept. */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        insert into penz_provider_status (provider_key, kind, last_failure_at, fail_streak, last_error)
        values (:key, :kind, now(), 1, :error)
        on conflict (provider_key) do update set kind = excluded.kind, last_failure_at = now(),
            fail_streak = penz_provider_status.fail_streak + 1, last_error = excluded.last_error, updated_at = now()
        """, nativeQuery = true)
    int recordFailure(@Param("key") String key, @Param("kind") String kind, @Param("error") String error);
}
