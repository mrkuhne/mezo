package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryPhotoApi;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.feature.pantry.service.PantryPhotoService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Label-photo draft endpoint (mezo-d8tr). Switch off -> the whole path 404s. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_PHOTO_SWITCH, havingValue = "true")
public class PantryPhotoController implements PantryPhotoApi {

    private final PantryPhotoService photoService;

    @Override
    public PantryScrapeResponse photoExtractPantryItem(MultipartFile photo, MultipartFile photo2) {
        return photoService.extract(photo, photo2);
    }
}
