package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzSmsKeyCreatedResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzApiKeyEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzApiKeyRepository;
import io.mrkuhne.mezo.feature.penz.service.sms.PenzSmsKeys;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SMS-ingest API keys (Boop Pénz L4, mezo-r36n9.102, spec §10.1.7). Created with the normal JWT; the plaintext
 * {@code mzp_…} is returned ONCE and only its SHA-256 hex and last four characters are stored. Creating a key
 * revokes the owner's other live keys AFTER the new one exists (the old app's rule: one working key, and a
 * failed create never leaves the owner keyless). Revoking is soft — the row stays listed as revoked.
 */
@Service
@RequiredArgsConstructor
public class PenzSmsKeyService {

    private final PenzApiKeyRepository repository;
    private final PenzMapper mapper;

    /** The owner behind a presented, live key — what the ingest filter authenticates as. */
    public record KeyOwner(UUID keyId, UUID owner) {
    }

    @Transactional(readOnly = true)
    public List<PenzSmsKeyResponse> list(UUID owner) {
        return repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner).stream()
            .map(mapper::toResponse).toList();
    }

    @Transactional
    public PenzSmsKeyCreatedResponse create(UUID owner, String name) {
        String trimmed = name == null ? "" : name.strip();
        if (trimmed.isEmpty()) {
            throw PenzErrors.field("name");
        }
        PenzSmsKeys.Generated key = PenzSmsKeys.generate();
        PenzApiKeyEntity row = new PenzApiKeyEntity();
        row.setCreatedBy(owner);
        row.setName(trimmed);
        row.setKeyHash(key.hash());
        row.setLast4(key.last4());
        PenzApiKeyEntity stored = repository.saveAndFlush(row);
        repository.revokeOthers(owner, stored.getId());
        return new PenzSmsKeyCreatedResponse()
            .key(mapper.toResponse(repository.findById(stored.getId()).orElseThrow()))
            .plaintext(key.plaintext());
    }

    @Transactional
    public void revoke(UUID owner, UUID id) {
        PenzApiKeyEntity row = repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_SMS_KEY_NOT_FOUND"));
        row.setRevoked(true);
        repository.saveAndFlush(row);
    }

    /**
     * The live (not revoked, not deleted) key with this plaintext, its last use stamped; empty for an unknown or
     * revoked key. Never logs the key.
     */
    @Transactional
    public Optional<KeyOwner> authenticate(String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) {
            return Optional.empty();
        }
        Optional<PenzApiKeyEntity> row = repository.findByKeyHashAndDeletedFalse(PenzSmsKeys.hash(plaintext))
            .filter(k -> !k.isRevoked());
        row.ifPresent(k -> repository.touch(k.getId(), Instant.now().truncatedTo(ChronoUnit.MICROS)));
        return row.map(k -> new KeyOwner(k.getId(), k.getCreatedBy()));
    }
}
