package io.mrkuhne.mezo.techcore.text;

/**
 * Surrogate-safe string truncation, extracted from {@code
 * io.mrkuhne.mezo.feature.notification.service.PushSender#truncateBody} for cross-slice reuse
 * (bd mezo-gzhp.1): the notification outbox lives in {@code feature.appnotification}, which must
 * not depend on {@code feature.notification} (that dependency runs the other way — see
 * {@code ArchitectureTest.feature_slices_are_cycle_free}), so this pure helper moved to
 * {@code techcore} where both slices can share it.
 */
public final class SafeTruncate {

    private SafeTruncate() {
    }

    /**
     * Truncates to at most {@code maxChars} UTF-16 units <b>without splitting a surrogate pair</b>.
     *
     * <p>A plain {@code substring(0, max)} that lands between the two halves of an emoji leaves a
     * lone surrogate, which is not a valid code point: the UTF-8 encoding of the payload turns it
     * into {@code ?}, so the user sees a stray question mark at the end of the notification.
     *
     * <p>Backing off one unit (rather than counting code points) keeps the property's meaning
     * intact: the result is still at most {@code maxChars} chars, just never a broken one.
     */
    public static String truncate(String text, int maxChars) {
        if (text == null || text.length() <= maxChars) {
            return text;
        }
        int end = Character.isHighSurrogate(text.charAt(maxChars - 1)) ? maxChars - 1 : maxChars;
        return text.substring(0, end);
    }
}
