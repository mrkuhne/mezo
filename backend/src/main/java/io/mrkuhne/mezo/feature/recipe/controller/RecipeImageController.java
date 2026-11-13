package io.mrkuhne.mezo.feature.recipe.controller;

import io.mrkuhne.mezo.api.controller.RecipeImageApi;
import io.mrkuhne.mezo.api.dto.RecipeImageResponse;
import io.mrkuhne.mezo.common.image.StoredImage;
import io.mrkuhne.mezo.feature.recipe.service.RecipeImageService;
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
 * Implements the generated {@link RecipeImageApi}. The GET answers with the stored bytes and sets the
 * stored Content-Type itself (the contract lists both JPEG and PNG, so negotiation alone could not
 * pick the right one); the photo is private to the owner, `no-cache` + ETag (filter), and `nosniff`.
 */
@RestController
@RequiredArgsConstructor
public class RecipeImageController implements RecipeImageApi {

    private final RecipeImageService service;
    private final CurrentUserId currentUserId;

    @Override
    public RecipeImageResponse putRecipeImage(UUID id, MultipartFile photo) {
        return service.put(currentUserId.get(), id, photo);
    }

    @Override
    public Resource getRecipeImage(UUID id) {
        StoredImage image = service.get(currentUserId.get(), id);
        if (RequestContextHolder.currentRequestAttributes() instanceof ServletRequestAttributes attrs
            && attrs.getResponse() instanceof HttpServletResponse response) {
            // The URL is the same for every version of a recipe's photo, so no max-age: the client
            // always revalidates. The ETag (a hash of the bytes, added by PhotoEtagConfiguration's
            // filter) changes on every replace and answers an unchanged photo with a 304.
            response.setHeader("Cache-Control", "private, no-cache");
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.setContentType(image.contentType());
        }
        return new ByteArrayResource(image.bytes());
    }

    @Override
    public void deleteRecipeImage(UUID id) {
        service.delete(currentUserId.get(), id);
    }
}
