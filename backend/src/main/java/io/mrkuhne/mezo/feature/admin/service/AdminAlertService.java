package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminAlertsResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Owner status-band alert rules (mezo-kjwa). Skeleton only: always returns an empty alert
 * list. The actual rule evaluation (cost spike, LLM error rate, missed jobs, quiet testers)
 * is filled in by a later slice.
 */
@Service
@RequiredArgsConstructor
public class AdminAlertService {

    private final AdminProperties properties;

    public AdminAlertsResponse alerts() {
        return new AdminAlertsResponse()
                .generatedAt(OffsetDateTime.now(properties.reportZone()))
                .alerts(List.of());
    }
}
