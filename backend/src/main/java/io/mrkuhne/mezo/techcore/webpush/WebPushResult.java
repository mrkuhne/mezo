package io.mrkuhne.mezo.techcore.webpush;

/** Outcome of one push POST. GONE means the caller must soft-delete that subscription. */
public enum WebPushResult { SENT, GONE, TOO_LARGE, THROTTLED, FAILED }
