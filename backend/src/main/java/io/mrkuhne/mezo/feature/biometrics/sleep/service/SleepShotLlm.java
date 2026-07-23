package io.mrkuhne.mezo.feature.biometrics.sleep.service;

/**
 * Sleep-owned LLM-vision port (ADR 0012): the sleep feature defines what it needs,
 * the companion feature adapts its provider onto it. Sleep never imports companion.
 */
public interface SleepShotLlm {

    /** One multimodal completion over a single screenshot. */
    String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType);
}
