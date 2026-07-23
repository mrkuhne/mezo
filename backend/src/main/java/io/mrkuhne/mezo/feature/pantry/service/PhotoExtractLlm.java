package io.mrkuhne.mezo.feature.pantry.service;

import java.util.List;

/**
 * Consumer-owned LLM port for the photo import (mezo-d8tr, ADR 0012). Pantry defines the seam it
 * needs; the companion feature provides the adapter ({@code PantryPhotoLlmAdapter}) delegating to
 * the real {@code CompanionLlm} multi-image overload — the only cross-feature dependency keeps
 * pointing companion → pantry (never pantry → companion), so the ArchUnit slice-cycle check stays
 * closed. The nested record mirrors {@code CompanionLlm.InlineImage} with pantry-owned types.
 */
public interface PhotoExtractLlm {

    /** An ephemeral inline image — bytes live only for the call, never stored. */
    record Image(byte[] bytes, String mimeType) {}

    /** One-shot multimodal completion on the cheap tier. */
    String complete(String systemPrompt, String userMessage, List<Image> images);
}
