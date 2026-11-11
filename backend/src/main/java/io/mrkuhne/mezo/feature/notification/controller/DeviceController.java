package io.mrkuhne.mezo.feature.notification.controller;

import io.mrkuhne.mezo.api.controller.DeviceApi;
import io.mrkuhne.mezo.api.dto.ApnsDeviceIn;
import io.mrkuhne.mezo.feature.notification.service.ApnsDeviceService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/devices surface (Boop B1, mezo-r36n9.11) — thin delegation to {@link ApnsDeviceService}. */
@RestController
@RequiredArgsConstructor
public class DeviceController implements DeviceApi {

    private final ApnsDeviceService service;
    private final CurrentUserId currentUserId;

    @Override
    public void registerApnsDevice(ApnsDeviceIn in) {
        service.register(currentUserId.get(), in.getDeviceId(), in.getToken(), in.getEnvironment().getValue(),
            in.getBundleId(), in.getAppVersion());
    }

    @Override
    public void unregisterApnsDevice(UUID deviceId) {
        service.unregister(currentUserId.get(), deviceId);
    }
}
