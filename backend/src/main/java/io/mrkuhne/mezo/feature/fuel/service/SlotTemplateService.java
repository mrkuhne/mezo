package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.SlotTemplateListResponse;
import io.mrkuhne.mezo.api.dto.SlotTemplateRequest;
import io.mrkuhne.mezo.api.dto.SlotTemplateResponse;
import io.mrkuhne.mezo.api.dto.SlotTemplateSlot;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import io.mrkuhne.mezo.feature.fuel.repository.MealSlotTemplateRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Meal-slot template CRUD (bd mezo-7102) — server-side validation mirrors the FE
 *  deterministic ERRORS (spec docs/superpowers/specs/2026-08-05-fuel-meal-slot-templates-design.md §4). */
@Service
@RequiredArgsConstructor
public class SlotTemplateService {

    private static final Set<String> DAY_TYPES = Set.of("rest", "training_am", "training_pm");
    private static final Set<String> TRAINING_ANCHORS = Set.of("training_start", "training_end");
    private static final int BUDGET_PCT_TOTAL = 100;
    private static final int BUDGET_PCT_TOLERANCE = 1;

    private final MealSlotTemplateRepository repository;

    public SlotTemplateListResponse list(UUID userId) {
        return SlotTemplateListResponse.builder()
            .templates(repository.findAllByCreatedByAndDeletedFalse(userId).stream().map(this::toResponse).toList())
            .build();
    }

    @Transactional
    public SlotTemplateResponse put(UUID userId, String dayType, SlotTemplateRequest req) {
        requireDayType(dayType);
        validateSlots(dayType, req.getSlots());
        MealSlotTemplateEntity row = repository.findByCreatedByAndDayTypeAndDeletedFalse(userId, dayType)
            .orElseGet(() -> {
                MealSlotTemplateEntity e = new MealSlotTemplateEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                e.setDayType(dayType);
                return e;
            });
        row.setSlots(req.getSlots().stream().map(this::toJson).toList());
        repository.save(row);
        return toResponse(row);
    }

    @Transactional
    public void delete(UUID userId, String dayType) {
        requireDayType(dayType);
        MealSlotTemplateEntity row = repository.findByCreatedByAndDayTypeAndDeletedFalse(userId, dayType)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        repository.delete(row); // soft via @SQLDelete
    }

    private void requireDayType(String dayType) {
        if (!DAY_TYPES.contains(dayType)) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "dayType").build());
        }
    }

    /** Collect-then-throw (error_handling.md:109-121) so the client gets every problem at once. */
    private void validateSlots(String dayType, List<SlotTemplateSlot> slots) {
        List<SystemMessage> errors = new ArrayList<>();

        // Contract already enforces @Size(min=2,max=8); this guard covers any caller that
        // bypasses bean validation (e.g. direct service use, malformed/empty list).
        if (slots == null || slots.size() < 2 || slots.size() > 8) {
            errors.add(SystemMessage.field("VALIDATION_INVALID_VALUE", "slots").build());
            throw new SystemRuntimeErrorException(errors);
        }

        int budgetSum = slots.stream().mapToInt(SlotTemplateSlot::getBudgetPct).sum();
        if (Math.abs(budgetSum - BUDGET_PCT_TOTAL) > BUDGET_PCT_TOLERANCE) {
            errors.add(SystemMessage.error("FUEL_SLOT_TEMPLATE_BUDGET_SUM").build());
        }

        boolean trainingAnchorOnRestDay = false;
        for (SlotTemplateSlot slot : slots) {
            boolean fixed = "fixed".equals(slot.getAnchorType());
            if (fixed && slot.getTime() == null) {
                errors.add(SystemMessage.field("VALIDATION_INVALID_VALUE", "slots").build());
            } else if (!fixed && slot.getOffsetMin() == null) {
                errors.add(SystemMessage.field("VALIDATION_INVALID_VALUE", "slots").build());
            }
            if ("rest".equals(dayType) && TRAINING_ANCHORS.contains(slot.getAnchorType())) {
                trainingAnchorOnRestDay = true;
            }
        }
        if (trainingAnchorOnRestDay) {
            errors.add(SystemMessage.error("FUEL_SLOT_TEMPLATE_ANCHOR_INVALID").build());
        }

        if (!errors.isEmpty()) {
            throw new SystemRuntimeErrorException(errors);
        }
    }

    private SlotTemplateResponse toResponse(MealSlotTemplateEntity entity) {
        return SlotTemplateResponse.builder()
            .dayType(SlotTemplateResponse.DayTypeEnum.fromValue(entity.getDayType()))
            .slots(entity.getSlots().stream().map(this::toSlot).toList())
            .build();
    }

    private SlotTemplateSlot toSlot(MealSlotJson json) {
        return SlotTemplateSlot.builder()
            .label(json.label())
            .slotKind(json.slotKind())
            .role(json.role())
            .anchorType(json.anchorType())
            .time(json.time())
            .offsetMin(json.offsetMin())
            .budgetPct(json.budgetPct())
            .build();
    }

    private MealSlotJson toJson(SlotTemplateSlot slot) {
        return new MealSlotJson(slot.getLabel(), slot.getSlotKind(), slot.getRole(),
            slot.getAnchorType(), slot.getTime(), slot.getOffsetMin(), slot.getBudgetPct());
    }
}
