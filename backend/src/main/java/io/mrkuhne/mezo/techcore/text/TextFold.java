package io.mrkuhne.mezo.techcore.text;

import java.text.Normalizer;

/**
 * Lowercase + NFD ékezet-strip — "Túrós" → "turos". A {@code ToolText.fold} (mezo-sxe) promóciója
 * (bd mezo-06o0.1): a mention-detektálás a {@code feature.people}-ben él, amely nem importálhat
 * {@code feature.companion}-t (companion→people él már létezik — a fordított irány új slice-ciklust
 * zárna a FreezingArchRule alatt), ezért a tiszta helper techcore-ba került, a {@code SafeTruncate}
 * mintájára. {@code ToolText.fold} ide delegál.
 */
public final class TextFold {

    private TextFold() {
    }

    public static String fold(String text) {
        return text == null ? ""
                : Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
