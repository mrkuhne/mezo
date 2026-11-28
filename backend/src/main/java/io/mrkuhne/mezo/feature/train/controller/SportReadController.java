package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.SportApi;
import io.mrkuhne.mezo.api.dto.SportBodyResponse;
import io.mrkuhne.mezo.api.dto.SportGapsResponse;
import io.mrkuhne.mezo.api.dto.SportLoadResponse;
import io.mrkuhne.mezo.api.dto.SportOverviewResponse;
import io.mrkuhne.mezo.api.dto.SportShoulderResponse;
import io.mrkuhne.mezo.feature.train.service.sport.SportReadService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Boop Sport S2 (mezo-r36n9.202) — the Sport area's read models; mappings come from {@link SportApi}. */
@RestController
@RequiredArgsConstructor
public class SportReadController implements SportApi {

    private static final int DEFAULT_WEEKS = 6;

    private final SportReadService sportReadService;
    private final CurrentUserId currentUserId;

    @Override
    public SportOverviewResponse getSportOverview(LocalDate week) {
        return sportReadService.overview(currentUserId.get(), week);
    }

    @Override
    public SportLoadResponse getSportLoad(Integer weeks) {
        return sportReadService.load(currentUserId.get(), weeks == null ? DEFAULT_WEEKS : weeks);
    }

    @Override
    public SportBodyResponse getSportBody(LocalDate week) {
        return sportReadService.body(currentUserId.get(), week);
    }

    @Override
    public SportShoulderResponse getSportShoulder(Integer weeks) {
        return sportReadService.shoulder(currentUserId.get(), weeks == null ? DEFAULT_WEEKS : weeks);
    }

    @Override
    public SportGapsResponse getSportGaps(LocalDate week) {
        return sportReadService.gaps(currentUserId.get(), week);
    }
}
