package io.mrkuhne.mezo.feature.biometrics.sleep.controller;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.LogSleepRequest;
import io.mrkuhne.mezo.feature.biometrics.sleep.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/biometrics/sleep")
@RequiredArgsConstructor
public class SleepLogController {

    private final SleepLogService service;
    private final CurrentUserId currentUserId;

    @GetMapping
    public List<SleepLogResponse> list() {
        return service.list(currentUserId.get());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SleepLogResponse log(@Valid @RequestBody LogSleepRequest req) {
        return service.log(currentUserId.get(), req);
    }
}
