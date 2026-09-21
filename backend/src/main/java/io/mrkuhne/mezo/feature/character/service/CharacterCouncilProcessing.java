package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.api.dto.CharacterCouncilStatusResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterCouncilEditionEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterCouncilEditionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Short owner-serialized leases. No model work happens while this transaction is open. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterCouncilProcessing {
    private final CharacterCouncilEditionRepository editions;
    private final CharacterRunRepository runs;
    private final CharacterCouncilProperties properties;
    private final EntityManager entityManager;

    public record Lease(UUID owner, LocalDate day, UUID token) {}

    public CharacterCouncilStatusResponse status(UUID owner, LocalDate day) {
        var e = editions.findByCreatedByAndDay(owner, day).orElse(null);
        var input = runs.findByCreatedByAndKindAndDay(owner, "NIGHTLY", day.minusDays(1));
        String state = e != null ? e.getStatus()
                : input.filter(run -> "FAILED".equals(run.getStatus())).isPresent() ? "FAILED" : "WAITING";
        return CharacterCouncilStatusResponse.builder().day(day)
                .status(CharacterCouncilStatusResponse.StatusEnum.fromValue(state))
                .completedAt(e == null || e.getCompletedAt() == null ? null : e.getCompletedAt().atOffset(ZoneOffset.UTC))
                .conferenceId(e == null ? null : e.getConferenceId())
                .sourceThrough(input.filter(run -> "SUCCESS".equals(run.getStatus())).isPresent() ? day.minusDays(1) : null).build();
    }

    @Transactional
    public Lease claim(UUID owner, LocalDate day) {
        var user = entityManager.find(AppUserEntity.class, owner, LockModeType.PESSIMISTIC_WRITE);
        if (user == null || user.getStatus() != AppUserEntity.UserStatus.ACTIVE) return null;
        var e = editions.findByCreatedByAndDay(owner, day).orElse(null);
        if (e != null && (List.of("COMPLETED", "QUIET").contains(e.getStatus())
                || e.getAttempts() >= properties.maxAttempts())) return null;
        if (e != null && "PROCESSING".equals(e.getStatus()) && e.getStartedAt() != null
                && e.getStartedAt().isAfter(Instant.now().minusSeconds(properties.leaseMinutes() * 60L))) return null;
        if (runs.findByCreatedByAndKindAndDay(owner, "NIGHTLY", day.minusDays(1))
                .filter(run -> "SUCCESS".equals(run.getStatus())).isEmpty()) return null;
        if (e == null) {
            e = new CharacterCouncilEditionEntity(); e.setCreatedBy(owner); e.setDay(day);
        }
        e.setAttempts(e.getAttempts() + 1);
        e.setStatus("PROCESSING"); e.setProcessingToken(UUID.randomUUID()); e.setStartedAt(Instant.now());
        editions.saveAndFlush(e);
        return new Lease(owner, day, e.getProcessingToken());
    }

    @Transactional
    public void quiet(Lease lease) { finish(lease, "QUIET", null); }

    @Transactional
    public void failed(Lease lease) { finish(lease, "FAILED", null); }

    @Transactional
    public void completed(Lease lease, UUID conferenceId) { finish(lease, "COMPLETED", conferenceId); }

    /** Called in the publication transaction before any mutation. */
    @Transactional
    public boolean owns(Lease lease) {
        var user = entityManager.find(AppUserEntity.class, lease.owner(), LockModeType.PESSIMISTIC_WRITE);
        if (user == null || user.getStatus() != AppUserEntity.UserStatus.ACTIVE) return false;
        return editions.findByCreatedByAndDay(lease.owner(), lease.day())
                .filter(e -> "PROCESSING".equals(e.getStatus()) && lease.token().equals(e.getProcessingToken()))
                .isPresent();
    }

    private void finish(Lease lease, String status, UUID conferenceId) {
        if (!owns(lease)) return;
        var e = editions.findByCreatedByAndDay(lease.owner(), lease.day()).orElseThrow();
        e.setStatus(status); e.setConferenceId(conferenceId);
        e.setCompletedAt("FAILED".equals(status) ? null : Instant.now());
    }
}
