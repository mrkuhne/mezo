package io.mrkuhne.mezo.feature.meal.controller;

import io.mrkuhne.mezo.api.controller.MealPhotoApi;
import io.mrkuhne.mezo.api.dto.MealPhotoResponse;
import io.mrkuhne.mezo.common.image.StoredImage;
import io.mrkuhne.mezo.feature.meal.service.MealPhotoService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.multipart.MultipartFile;

/**
 * Implements the generated {@link MealPhotoApi}. The GET answers with the stored bytes and sets the
 * stored Content-Type itself (the contract lists both JPEG and PNG, so negotiation alone could not
 * pick the right one); the photo is private to the owner and `nosniff`.
 */
@RestController
@RequiredArgsConstructor
public class MealPhotoController implements MealPhotoApi {

    private final MealPhotoService service;
    private final CurrentUserId currentUserId;

    @Override
    public MealPhotoResponse putMealPhoto(UUID id, MultipartFile photo) {
        return service.put(currentUserId.get(), id, photo);
    }

    @Override
    public Resource getMealPhoto(UUID id) {
        StoredImage image = service.get(currentUserId.get(), id);
        if (RequestContextHolder.currentRequestAttributes() instanceof ServletRequestAttributes attrs
            && attrs.getResponse() instanceof HttpServletResponse response) {
            response.setContentType(image.contentType());
            response.setHeader("Cache-Control", "private, max-age=3600");
            response.setHeader("X-Content-Type-Options", "nosniff");
        }
        return new ByteArrayResource(image.bytes());
    }

    @Override
    public void deleteMealPhoto(UUID id) {
        service.delete(currentUserId.get(), id);
    }

    @Override
    public void deleteAllMealPhotos() {
        service.deleteAll(currentUserId.get());
    }
}
