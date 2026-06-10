package io.mrkuhne.mezo.feature.biometrics.weight.controller;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
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
@RequestMapping("/api/biometrics/weight")
@RequiredArgsConstructor
public class WeightLogController {

    private final WeightLogService service;
    private final CurrentUserId currentUserId;

    @GetMapping
    public List<WeightLogResponse> list() {
        return service.list(currentUserId.get());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WeightLogResponse log(@Valid @RequestBody LogWeightRequest req) {
        return service.log(currentUserId.get(), req);
    }
}
