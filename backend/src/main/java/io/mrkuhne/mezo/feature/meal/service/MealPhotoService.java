package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.MealPhotoResponse;
import io.mrkuhne.mezo.common.image.ImageStore;
import io.mrkuhne.mezo.common.image.StoredImage;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * The owner's meal photos (Boop B4, decisions 14/19): one per meal, kept until the owner deletes
 * it. Every path resolves the meal through the owner-scoped finder first, so another user's meal
 * id is a 404 before any image is touched. The bytes themselves live in {@link ImageStore}.
 */
@Service
@RequiredArgsConstructor
public class MealPhotoService {

    private final MealRepository meals;
    private final ImageStore images;

    @Transactional
    public MealPhotoResponse put(UUID userId, UUID mealId, MultipartFile photo) {
        MealEntity meal = requireMeal(userId, mealId);
        // Reject oversize on the declared size BEFORE the body is read into memory.
        if (photo == null || photo.isEmpty() || photo.getSize() > ImageStore.MAX_BYTES) {
            throw invalidPhoto();
        }
        byte[] bytes;
        try {
            bytes = photo.getBytes();
        } catch (IOException e) {
            throw invalidPhoto();
        }
        StoredImage stored = images.put(userId, bytes, photo.getContentType());
        UUID old = meal.getPhotoId();
        meal.setPhotoId(stored.id());
        meals.saveAndFlush(meal); // repoint first; the old bytes are released only after
        if (old != null) {
            images.delete(userId, old);
        }
        return new MealPhotoResponse().bytes((long) stored.bytes().length).width(stored.width()).height(stored.height());
    }

    @Transactional(readOnly = true)
    public StoredImage get(UUID userId, UUID mealId) {
        MealEntity meal = requireMeal(userId, mealId);
        return images.get(userId, requirePhotoId(meal)).orElseThrow(OwnershipGuard::notFound);
    }

    @Transactional
    public void delete(UUID userId, UUID mealId) {
        MealEntity meal = requireMeal(userId, mealId);
        UUID photoId = requirePhotoId(meal);
        meal.setPhotoId(null);
        meals.saveAndFlush(meal);
        images.delete(userId, photoId);
    }

    /** Every photo of the caller; the meals stay. Recipe images are a different owner of bytes and are not touched. */
    @Transactional
    public void deleteAll(UUID userId) {
        List<UUID> ids = meals.findAllPhotoIds(userId); // soft-deleted meals included
        meals.clearAllPhotoIds(userId);
        images.deleteAll(userId, ids);
    }

    private MealEntity requireMeal(UUID userId, UUID mealId) {
        return meals.findByIdAndCreatedByAndDeletedFalse(mealId, userId).orElseThrow(OwnershipGuard::notFound);
    }

    private static UUID requirePhotoId(MealEntity meal) {
        if (meal.getPhotoId() == null) {
            throw OwnershipGuard.notFound();
        }
        return meal.getPhotoId();
    }

    private static SystemRuntimeErrorException invalidPhoto() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
    }
}
