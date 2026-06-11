package io.mrkuhne.mezo.feature.biometrics.sleep.controller;

import io.mrkuhne.mezo.api.controller.SleepApi;
import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link SleepApi}. */
@RestController
@RequiredArgsConstructor
public class SleepLogController implements SleepApi {

    private final SleepLogService service;
    private final CurrentUserId currentUserId;

    @Override
    public List<SleepLogResponse> listSleepLogs() {
        return service.list(currentUserId.get());
    }

    @Override
    public SleepLogResponse logSleep(LogSleepRequest logSleepRequest) {
        return service.log(currentUserId.get(), logSleepRequest);
    }
}
