package io.mrkuhne.mezo.feature.wearable.controller;

import io.mrkuhne.mezo.api.controller.WearableApi;
import io.mrkuhne.mezo.api.dto.CalendarDaysRequest;
import io.mrkuhne.mezo.api.dto.DailyMetricBatchRequest;
import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.api.dto.SleepNightBatchRequest;
import io.mrkuhne.mezo.api.dto.WorkoutBatchRequest;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.service.CalendarSnapshotService;
import io.mrkuhne.mezo.feature.wearable.service.DailyMetricService;
import io.mrkuhne.mezo.feature.wearable.service.WearableSleepService;
import io.mrkuhne.mezo.feature.wearable.service.WearableWorkoutService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link WearableApi}. */
@RestController
@RequiredArgsConstructor
public class WearableController implements WearableApi {

    private final WearableSleepService sleepService;
    private final DailyMetricService dailyMetricService;
    private final WearableWorkoutService workoutService;
    private final CalendarSnapshotService calendarService;
    private final WearableProperties properties;
    private final CurrentUserId currentUserId;

    @Override
    public IngestResult ingestSleepNights(SleepNightBatchRequest request) {
        return sleepService.ingest(currentUserId.get(), request.getNights(), LocalDate.now(ZoneId.of(properties.zone())));
    }

    @Override
    public IngestResult ingestDailyMetrics(DailyMetricBatchRequest request) {
        return dailyMetricService.ingest(currentUserId.get(), request.getDays());
    }

    @Override
    public IngestResult ingestWorkouts(WorkoutBatchRequest request) {
        return workoutService.ingest(currentUserId.get(), request.getWorkouts());
    }

    @Override
    public void replaceCalendarDays(CalendarDaysRequest request) {
        calendarService.replace(currentUserId.get(), request.getDays());
    }
}
