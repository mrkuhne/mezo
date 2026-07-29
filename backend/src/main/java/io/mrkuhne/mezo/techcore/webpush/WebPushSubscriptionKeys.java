package io.mrkuhne.mezo.techcore.webpush;

/** Transport-agnostic subscription input — keeps techcore free of any feature entity. */
public record WebPushSubscriptionKeys(String endpoint, String p256dh, String auth) {}
