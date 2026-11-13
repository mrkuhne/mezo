package io.mrkuhne.mezo.common.image;

import java.util.UUID;

/** One stored image as the callers see it: the bytes, their (sniffed) content type and pixel size. */
public record StoredImage(UUID id, byte[] bytes, String contentType, int width, int height) {
}
