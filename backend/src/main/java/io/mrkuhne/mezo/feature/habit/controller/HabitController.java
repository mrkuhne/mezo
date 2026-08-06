package io.mrkuhne.mezo.feature.habit.controller;

import io.mrkuhne.mezo.api.controller.HabitApi;
import io.mrkuhne.mezo.api.dto.HabitCatalogResponse;
import io.mrkuhne.mezo.api.dto.HabitChainAdmin;
import io.mrkuhne.mezo.api.dto.HabitChainCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitChainUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitCheckRequest;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitDefAdmin;
import io.mrkuhne.mezo.api.dto.HabitDefCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitDefUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitReorderRequest;
import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.api.dto.HabitSuggestRequest;
import io.mrkuhne.mezo.api.dto.HabitSuggestResponse;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.service.HabitAdminService;
import io.mrkuhne.mezo.feature.habit.service.HabitAiService;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/habit surface (bd mezo-d1jb, ADR 0010; admin/editor surface added mezo-n5e9.1) — thin
 * delegation, ownership from the principal; gated on {@code HABIT_SWITCH} (off ⇒ the whole
 * surface 404s and no habit beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitController implements HabitApi {

    private final HabitService habitService;
    private final HabitAdminService habitAdminService;
    private final HabitAiService habitAiService;
    private final CurrentUserId currentUserId;

    @Override
    public HabitDayResponse getHabitDay(LocalDate date) {
        return habitService.getDay(currentUserId.get(), date);
    }

    @Override
    public HabitWriteResponse checkHabit(String key, HabitCheckRequest request) {
        return habitService.check(currentUserId.get(), key, request.getDate());
    }

    @Override
    public HabitResponse uncheckHabit(String key, LocalDate date) {
        return habitService.uncheck(currentUserId.get(), key, date);
    }

    @Override
    public HabitSummaryResponse getHabitSummary() {
        return habitService.summary(currentUserId.get());
    }

    @Override
    public HabitCatalogResponse getHabitCatalog() {
        return habitAdminService.catalog(currentUserId.get());
    }

    @Override
    public HabitChainAdmin createHabitChain(HabitChainCreateRequest request) {
        return habitAdminService.createChain(currentUserId.get(), request);
    }

    @Override
    public HabitChainAdmin updateHabitChain(UUID id, HabitChainUpdateRequest request) {
        return habitAdminService.updateChain(currentUserId.get(), id, request);
    }

    @Override
    public void deleteHabitChain(UUID id) {
        habitAdminService.deleteChain(currentUserId.get(), id);
    }

    @Override
    public HabitChainAdmin reorderHabitChain(UUID id, HabitReorderRequest request) {
        return habitAdminService.reorder(currentUserId.get(), id, request);
    }

    @Override
    public HabitDefAdmin createHabitDef(HabitDefCreateRequest request) {
        return habitAdminService.createDef(currentUserId.get(), request);
    }

    @Override
    public HabitDefAdmin updateHabitDef(UUID id, HabitDefUpdateRequest request) {
        return habitAdminService.updateDef(currentUserId.get(), id, request);
    }

    @Override
    public void deleteHabitDef(UUID id) {
        habitAdminService.deleteDef(currentUserId.get(), id);
    }

    @Override
    public HabitSuggestResponse suggestHabits(HabitSuggestRequest request) {
        return habitAiService.suggest(currentUserId.get(), request);
    }
}
