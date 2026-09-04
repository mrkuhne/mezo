package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.ProtocolHistoryEntry;
import io.mrkuhne.mezo.api.dto.ProtocolItemCreateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemPatchRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemResponse;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.ProtocolViewResponse;
import io.mrkuhne.mezo.feature.fuel.config.FuelProtocolProperties;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.entity.StackZone;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads the single owner-scoped supplement Stack/Protocol and hosts the "living protocol"
 * occurrence operations ({@link #addItem}, {@link #patchItem}, {@link #deleteItem}) that mutate
 * one {@code protocol_item} row in place. There is no whole-selection (re)activate step — the
 * pre-mezo-vx9v {@code activate} endpoint that snapshotted an entire selection at once was removed
 * in Task 10; the single living protocol row is now created lazily by {@link #ensureActive} on the
 * first occurrence write and only ever version-bumped in place by {@link #touch}.
 *
 * <p>{@link #getView} lazily backfills pre-vx9v rows (created before {@code slot_key} existed):
 * on first read it runs {@link PlacementEngine#place} for every item still missing a zone and
 * persists the result, so a second read never re-derives. Confidence is config-backed
 * ({@link FuelProtocolProperties}) in the deterministic era — no computed value yet.
 */
@Service
@RequiredArgsConstructor
public class ProtocolService {

    private static final String STATUS_ACTIVE = "active";
    private static final String KIND_FOOD = "food";
    private static final String SOURCE_USER = "user";
    private static final String REASON_MANUAL = "Kézzel ide helyezve.";

    private final ProtocolRepository protocolRepository;
    private final ProtocolItemRepository itemRepository;
    private final PantryItemRepository pantryItemRepository;
    private final FuelProtocolProperties properties;
    private final PlacementEngine placementEngine;

    @Transactional
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

    // --- occurrence ops (mezo-vx9v living protocol) ---

    @Transactional
    public ProtocolItemResponse addItem(UUID userId, ProtocolItemCreateRequest request) {
        PantryItemEntity pantryItem = requireOwnedSupplement(userId, request.getPantryItemId());
        ProtocolEntity protocol = ensureActive(userId);
        String slotKey;
        String source;
        String reason;
        String restDay;
        boolean pinned;
        if (request.getSlotKey() != null) {
            slotKey = request.getSlotKey();
            source = SOURCE_USER;
            pinned = true;
            reason = REASON_MANUAL;
            restDay = null;
        } else {
            PlacementEngine.Placement placement = placementEngine.place(pantryItem);
            slotKey = placement.slotKey();
            source = placement.source();
            pinned = false;
            reason = placement.reasonHu();
            restDay = placement.restDayFallback();
        }
        rejectDuplicate(protocol.getId(), pantryItem.getId(), slotKey);
        ProtocolItemEntity item = new ProtocolItemEntity();
        item.setCreatedBy(userId);
        item.setProtocolId(protocol.getId());
        item.setPantryItemId(pantryItem.getId());
        item.setItemOrder(nextItemOrder(protocol.getId()));
        item.setSlotKey(slotKey);
        item.setDose(request.getDose());
        item.setPinned(pinned);
        item.setPlacementSource(source);
        item.setPlacementReason(reason);
        item.setRestDayFallback(restDay);
        itemRepository.save(item);
        touch(protocol);
        return toItemResponse(item, pantryItem.getCatalog().getName());
    }

    @Transactional
    public ProtocolItemResponse patchItem(UUID userId, UUID id, ProtocolItemPatchRequest request) {
        ProtocolEntity protocol = requireActiveOwned(userId);          // 404 when none
        ProtocolItemEntity item = requireItem(protocol.getId(), id);   // 404 when not in protocol
        if (Boolean.FALSE.equals(request.getPinned()) && request.getSlotKey() != null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "pinned").build(), HttpStatus.BAD_REQUEST);
        }
        if (request.getSlotKey() != null) {                            // manual move = pin
            // Except this item's own id: a no-op re-pin to the occurrence's CURRENT zone must not
            // 409 against itself (mezo-vx9v review finding — mirrors the unpin branch below).
            rejectDuplicateExcept(protocol.getId(), item.getPantryItemId(), request.getSlotKey(), item.getId());
            item.setSlotKey(request.getSlotKey());
            item.setPinned(true);
            item.setPlacementSource(SOURCE_USER);
            item.setPlacementReason(REASON_MANUAL);
            item.setRestDayFallback(null);
        }
        if (Boolean.FALSE.equals(request.getPinned())) {               // unpin → engine re-places
            PantryItemEntity pantryItem = requireOwnedSupplement(userId, item.getPantryItemId());
            PlacementEngine.Placement placement = placementEngine.place(pantryItem);
            rejectDuplicateExcept(protocol.getId(), item.getPantryItemId(), placement.slotKey(), item.getId());
            item.setSlotKey(placement.slotKey());
            item.setPinned(false);
            item.setPlacementSource(placement.source());
            item.setPlacementReason(placement.reasonHu());
            item.setRestDayFallback(placement.restDayFallback());
        }
        if (request.getDose() != null) {
            item.setDose(request.getDose());
        }
        touch(protocol);
        return toItemResponse(item, pantryName(item.getPantryItemId()));
    }

    @Transactional
    public void deleteItem(UUID userId, UUID id) {
        ProtocolEntity protocol = requireActiveOwned(userId);
        ProtocolItemEntity item = requireItem(protocol.getId(), id);
        itemRepository.delete(item);   // soft via @SQLDelete
        touch(protocol);
    }

    private ProtocolResponse toResponse(ProtocolEntity p) {
        List<ProtocolItemEntity> items = backfillAndSort(p.getId());
        return new ProtocolResponse()
            .id(p.getId())
            .version(p.getVersion())
            .builtAt(p.getBuiltAt().atOffset(ZoneOffset.UTC))
            .status(ProtocolResponse.StatusEnum.fromValue(p.getStatus()))
            .confidence(p.getConfidence())
            .lastReplanReason(p.getLastReplanReason())
            .items(items.stream().map(i -> toItemResponse(i, pantryName(i.getPantryItemId()))).toList());
    }

    /**
     * Loads a protocol's items, lazily backfills any pre-vx9v row still missing {@code slotKey}
     * (persists the placement so a second read never re-derives), and returns them sorted by
     * {@link StackZone} render order then {@code itemOrder}.
     *
     * <p>Backfill collision handling: the partial unique index only protects rows that already
     * have a {@code slotKey} — two (or many more) un-backfilled legacy rows for the SAME pantry
     * item can already coexist (Task 1 review finding; a historical artifact of the now-removed
     * whole-selection {@code activate} endpoint, which had no uniqueness check on its selection).
     * When the engine's placement for one of them would collide with a
     * zone already taken (by another item of the same pantry item, in this same batch or already
     * backfilled), we advance to the next {@link StackZone} in canonical order (wrapping) until a
     * free zone is found. When there are MORE duplicates than the 8 available zones, some of them
     * cannot be placed at all — persisting a taken zone anyway would violate {@code
     * uq_protocol_item_zone_occurrence} at flush and 500 every subsequent read of this row
     * (mezo-vx9v review finding). The correct resolution mirrors what {@code addItem}/{@code
     * patchItem} already do for a duplicate via {@code rejectDuplicate(Except)}: it IS a
     * duplicate, so the un-placeable overflow rows are soft-deleted instead of ever being written
     * with a colliding {@code slotKey} — never re-attempted, since the delete is itself persisted.
     */
    private List<ProtocolItemEntity> backfillAndSort(UUID protocolId) {
        List<ProtocolItemEntity> items = itemRepository.findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocolId);
        Map<UUID, Set<String>> takenZonesByItem = new HashMap<>();
        for (ProtocolItemEntity item : items) {
            if (item.getSlotKey() != null) {
                takenZonesByItem.computeIfAbsent(item.getPantryItemId(), k -> new HashSet<>()).add(item.getSlotKey());
            }
        }
        List<ProtocolItemEntity> resolved = new ArrayList<>();
        for (ProtocolItemEntity item : items) {
            if (item.getSlotKey() != null) {
                resolved.add(item);
                continue;
            }
            PantryItemEntity pantryItem = pantryItemRepository.findWithCatalogById(item.getPantryItemId()).orElse(null);
            // A missing pantry item (stale FK on an ancient row) still needs a resolvable zone —
            // the engine's own deterministic fallback covers the normal case; here we mirror it by
            // hand since PlacementEngine#place requires a non-null item.
            PlacementEngine.Placement placement = pantryItem == null
                ? new PlacementEngine.Placement(PlacementEngine.FALLBACK_ZONE, "fallback", PlacementEngine.FALLBACK_REASON, null)
                : placementEngine.place(pantryItem);
            Set<String> taken = takenZonesByItem.computeIfAbsent(item.getPantryItemId(), k -> new HashSet<>());
            String slotKey = resolveFreeZone(placement.slotKey(), taken);
            if (slotKey == null) {
                itemRepository.delete(item); // overflow duplicate — no zone left, soft-deleted, not re-tried
                continue;
            }
            item.setSlotKey(slotKey);
            item.setPinned(false);
            item.setPlacementSource(placement.source());
            item.setPlacementReason(placement.reasonHu());
            item.setRestDayFallback(placement.restDayFallback());
            taken.add(slotKey);
            resolved.add(item);
        }
        return resolved.stream()
            .sorted(Comparator.comparingInt((ProtocolItemEntity i) -> StackZone.fromKey(i.getSlotKey()).order())
                .thenComparing(ProtocolItemEntity::getItemOrder))
            .toList();
    }

    /** The preferred zone if free, otherwise the next {@link StackZone} in canonical order
     *  (wrapping); {@code null} when all 8 zones are already taken by this pantry item — the
     *  caller must NOT persist a fallback to an already-taken zone (would violate the unique
     *  index at flush). */
    private String resolveFreeZone(String preferredSlotKey, Set<String> takenSlotKeys) {
        if (!takenSlotKeys.contains(preferredSlotKey)) {
            return preferredSlotKey;
        }
        StackZone[] zones = StackZone.values();
        int start = StackZone.fromKey(preferredSlotKey).order();
        for (int offset = 1; offset <= zones.length; offset++) {
            StackZone candidate = zones[(start + offset) % zones.length];
            if (!takenSlotKeys.contains(candidate.key())) {
                return candidate.key();
            }
        }
        return null; // all 8 zones taken by this one pantry item — nothing free to assign
    }

    /** The single living protocol row — created on first write, version-bumped on every mutation. */
    private ProtocolEntity ensureActive(UUID userId) {
        return protocolRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .orElseGet(() -> {
                ProtocolEntity p = new ProtocolEntity();
                p.setCreatedBy(userId); // server-side ownership — never from the client
                p.setVersion(protocolRepository.maxVersion(userId) + 1);
                p.setBuiltAt(Instant.now());
                p.setStatus(STATUS_ACTIVE);
                p.setConfidence(properties.defaultConfidence());
                return protocolRepository.saveAndFlush(p);
            });
    }

    private void touch(ProtocolEntity protocol) {
        protocol.setVersion(protocol.getVersion() + 1);
        protocol.setBuiltAt(Instant.now());
    }

    private PantryItemEntity requireOwnedSupplement(UUID userId, UUID pantryItemId) {
        PantryItemEntity item = pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (KIND_FOOD.equals(item.getCatalog().getKind())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "pantryItemId").build(), HttpStatus.BAD_REQUEST);
        }
        return item;
    }

    private ProtocolEntity requireActiveOwned(UUID userId) {
        return protocolRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private ProtocolItemEntity requireItem(UUID protocolId, UUID id) {
        return itemRepository.findById(id)
            .filter(item -> item.getProtocolId().equals(protocolId))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private int nextItemOrder(UUID protocolId) {
        return itemRepository.findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocolId).size();
    }

    /** Owner-scoping is redundant here — the caller already resolved {@code pantryItemId} from a
     *  protocol item that itself only ever holds ids validated at write-time — so a plain lookup
     *  by id is enough for a display-name resolution. */
    private String pantryName(UUID pantryItemId) {
        return pantryItemRepository.findWithCatalogById(pantryItemId).map(p -> p.getCatalog().getName()).orElse(null);
    }

    private void rejectDuplicate(UUID protocolId, UUID pantryItemId, String slotKey) {
        rejectDuplicateExcept(protocolId, pantryItemId, slotKey, null);
    }

    private void rejectDuplicateExcept(UUID protocolId, UUID pantryItemId, String slotKey, UUID exceptId) {
        itemRepository
            .findByProtocolIdAndPantryItemIdAndSlotKeyAndDeletedFalse(protocolId, pantryItemId, slotKey)
            .filter(existing -> !existing.getId().equals(exceptId))
            .ifPresent(existing -> {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("FUEL_PROTOCOL_ITEM_DUPLICATE").build(), HttpStatus.CONFLICT);
            });
    }

    private ProtocolItemResponse toItemResponse(ProtocolItemEntity item, String pantryItemName) {
        return ProtocolItemResponse.builder()
            .id(item.getId())
            .pantryItemId(item.getPantryItemId())
            .slotKey(item.getSlotKey())
            .dose(item.getDose())
            .pinned(item.isPinned())
            .placementSource(ProtocolItemResponse.PlacementSourceEnum.fromValue(item.getPlacementSource()))
            .placementReason(item.getPlacementReason())
            .restDayFallback(item.getRestDayFallback())
            .dailyTotalHint(placementEngine.dailyTotalHint(pantryItemName))
            .build();
    }
}
