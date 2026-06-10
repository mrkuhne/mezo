package io.mrkuhne.mezo.feature.biometrics.checkin.controller;

import io.mrkuhne.mezo.feature.biometrics.checkin.dto.CheckInResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/biometrics/checkin")
@RequiredArgsConstructor
public class CheckInController {

    private final CheckInService service;
    private final CurrentUserId currentUserId;

    @GetMapping
    public List<CheckInResponse> listForDay(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.listForDay(currentUserId.get(), date);
    }

    @PostMapping
    public CheckInResponse save(@Valid @RequestBody SaveCheckInRequest req) {
        // 200 OK by default: this is an upsert, not a pure create.
        return service.save(currentUserId.get(), req);
    }
}
