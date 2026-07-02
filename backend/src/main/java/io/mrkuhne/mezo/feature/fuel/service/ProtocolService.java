package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.ProtocolActivateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolHistoryEntry;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.ProtocolViewResponse;
import io.mrkuhne.mezo.feature.fuel.config.FuelProtocolProperties;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and (re)activates the single owner-scoped supplement Stack/Protocol. Activating supersedes
 * the prior active row, bumps {@code version}, and snapshots the pantry selection as ordered
 * {@code protocol_item} rows. Confidence is config-backed ({@link FuelProtocolProperties}) in the
 * deterministic era — no computed value yet.
 */
@Service
@RequiredArgsConstructor
public class ProtocolService {

    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_SUPERSEDED = "superseded";
    private static final String KIND_FOOD = "food";

    private final ProtocolRepository protocolRepository;
    private final ProtocolItemRepository itemRepository;
    private final PantryItemRepository pantryItemRepository;
    private final FuelProtocolProperties properties;

    @Transactional(readOnly = true)
    public ProtocolViewResponse getView(UUID userId) {
        ProtocolEntity active = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE).orElse(null);
        List<ProtocolHistoryEntry> history = protocolRepository
            .findByCreatedByAndDeletedFalseOrderByVersionDesc(userId).stream()
            .map(p -> new ProtocolHistoryEntry()
                .version(p.getVersion())
                .builtAt(p.getBuiltAt().atOffset(ZoneOffset.UTC))
                .reason(p.getLastReplanReason()))
            .toList();
        return new ProtocolViewResponse()
            .active(active == null ? null : toResponse(active))
            .history(history);
    }

    @Transactional
    public ProtocolViewResponse activate(UUID userId, ProtocolActivateRequest request) {
        List<UUID> ids = request.getSelectedPantryItemIds();
        if (ids == null || ids.isEmpty()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_REQUIRED_FIELD", "selectedPantryItemIds").build(),
                HttpStatus.BAD_REQUEST);
        }
        for (UUID id : ids) {
            PantryItemEntity item = pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
            if (KIND_FOOD.equals(item.getKind())) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "selectedPantryItemIds").build(),
                    HttpStatus.BAD_REQUEST);
            }
        }
        protocolRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .ifPresent(prev -> prev.setStatus(STATUS_SUPERSEDED));
        // Push the supersede UPDATE before inserting the new active row: the partial unique index
        // uq_protocol_active_per_user forbids two active rows, and Hibernate flushes inserts before
        // updates within a transaction.
        protocolRepository.flush();

        ProtocolEntity next = new ProtocolEntity();
        next.setCreatedBy(userId); // server-side ownership — never from the client
        next.setVersion(protocolRepository.maxVersion(userId) + 1);
        next.setBuiltAt(Instant.now());
        next.setStatus(STATUS_ACTIVE);
        next.setConfidence(properties.defaultConfidence());
        next.setLastReplanReason(request.getReason());
        ProtocolEntity saved = protocolRepository.save(next);

        for (int i = 0; i < ids.size(); i++) {
            ProtocolItemEntity pi = new ProtocolItemEntity();
            pi.setCreatedBy(userId);
            pi.setProtocolId(saved.getId());
            pi.setPantryItemId(ids.get(i));
            pi.setItemOrder(i);
            itemRepository.save(pi);
        }
        return getView(userId);
    }

    private ProtocolResponse toResponse(ProtocolEntity p) {
        return new ProtocolResponse()
            .id(p.getId())
            .version(p.getVersion())
            .builtAt(p.getBuiltAt().atOffset(ZoneOffset.UTC))
            .status(ProtocolResponse.StatusEnum.fromValue(p.getStatus()))
            .confidence(p.getConfidence())
            .lastReplanReason(p.getLastReplanReason())
            .selectedPantryItemIds(itemRepository
                .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(p.getId()).stream()
                .map(ProtocolItemEntity::getPantryItemId).toList());
    }
}
