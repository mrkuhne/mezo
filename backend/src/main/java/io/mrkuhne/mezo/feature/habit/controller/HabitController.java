package io.mrkuhne.mezo.feature.habit.controller;

import io.mrkuhne.mezo.api.controller.HabitApi;
import io.mrkuhne.mezo.api.dto.HabitCheckRequest;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/habit surface (bd mezo-d1jb, ADR 0010) — thin delegation, ownership from the principal;
 * gated on {@code HABIT_SWITCH} (off ⇒ the whole surface 404s and no habit beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitController implements HabitApi {

    private final HabitService habitService;
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
}
