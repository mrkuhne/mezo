package io.mrkuhne.mezo.common.image;

import io.mrkuhne.mezo.common.image.entity.StoredImageEntity;
import io.mrkuhne.mezo.common.image.repository.StoredImageRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collection;
import java.util.Iterator;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owner-scoped store for the user's own images (meal photos, recipe images — Boop B4).
 *
 * <p>Bytes live in Postgres ({@code stored_image.bytes}): the backend pod has no volume, while
 * the database is on a PVC and is the thing the nightly {@code pg_dump} already backs up — so a
 * photo survives a pod restart and is in every backup with no new moving part.
 *
 * <p>Nothing is trusted from the client: the declared content type must be JPEG or PNG, the bytes
 * must begin with that format's magic number, and the image header must parse (the pixel size is
 * read from the header, never by decoding the picture, so a decompression bomb costs nothing).
 * Every read and delete is scoped to the owner; a foreign id behaves exactly like a missing one.
 */
@Component
@RequiredArgsConstructor
public class ImageStore {

    /** The cap, below the servlet's 6 MB multipart limit. */
    public static final int MAX_BYTES = 4 * 1024 * 1024;

    /** Largest accepted picture in pixels (a 1600 px phone photo is ~2 MP; this is generous). */
    static final long MAX_PIXELS = 40_000_000L;

    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

    private final StoredImageRepository repository;

    @Transactional
    public StoredImage put(UUID ownerId, byte[] bytes, String contentType) {
        String type = normalizeType(contentType);
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_BYTES || type == null
            || !startsWith(bytes, "image/jpeg".equals(type) ? JPEG_MAGIC : PNG_MAGIC)) {
            throw invalid();
        }
        int[] size = readSize(bytes, "image/jpeg".equals(type) ? "jpeg" : "png");
        if ((long) size[0] * size[1] > MAX_PIXELS) {
            throw invalid();
        }
        StoredImageEntity e = new StoredImageEntity();
        e.setCreatedBy(ownerId);
        e.setContentType(type);
        e.setBytes(bytes);
        e.setByteSize(bytes.length);
        e.setWidth(size[0]);
        e.setHeight(size[1]);
        StoredImageEntity saved = repository.save(e);
        return toStored(saved);
    }

    @Transactional(readOnly = true)
    public Optional<StoredImage> get(UUID ownerId, UUID id) {
        return repository.findByIdAndCreatedBy(id, ownerId).map(ImageStore::toStored);
    }

    /** Hard delete; true when a row was actually removed. */
    @Transactional
    public boolean delete(UUID ownerId, UUID id) {
        return repository.deleteOwned(ownerId, id) > 0;
    }

    @Transactional
    public void deleteAll(UUID ownerId, Collection<UUID> ids) {
        if (!ids.isEmpty()) {
            repository.deleteOwnedIn(ownerId, ids);
        }
    }

    /** Everything the user owns, meal photos and recipe images alike (account removal). */
    @Transactional
    public void deleteAllFor(UUID ownerId) {
        repository.deleteAllOwned(ownerId);
    }

    private static StoredImage toStored(StoredImageEntity e) {
        return new StoredImage(e.getId(), e.getBytes(), e.getContentType(), e.getWidth(), e.getHeight());
    }

    private static String normalizeType(String contentType) {
        if (contentType == null) {
            return null;
        }
        String base = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        return "image/jpeg".equals(base) || "image/png".equals(base) ? base : null;
    }

    private static boolean startsWith(byte[] bytes, byte[] magic) {
        if (bytes.length < magic.length) {
            return false;
        }
        for (int i = 0; i < magic.length; i++) {
            if (bytes[i] != magic[i]) {
                return false;
            }
        }
        return true;
    }

    /** Width and height from the image header only — no pixel decode. */
    private static int[] readSize(byte[] bytes, String format) {
        try (ImageInputStream in = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReadersByFormatName(format);
            if (!readers.hasNext()) {
                throw invalid();
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int w = reader.getWidth(0);
                int h = reader.getHeight(0);
                if (w <= 0 || h <= 0) {
                    throw invalid();
                }
                return new int[] {w, h};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof SystemRuntimeErrorException s) {
                throw s;
            }
            throw invalid();
        }
    }

    private static SystemRuntimeErrorException invalid() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
    }
}
