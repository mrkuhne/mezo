package io.mrkuhne.mezo.feature.companion.memory.service;

/** Lossless chunk boundaries shared by legacy prefix embeddings and canonical full-source chunks. */
public final class MemoryChunkText {
    private MemoryChunkText() {}

    public static int end(String content, int start, int maxChars) {
        int end = Math.min(content.length(), start + maxChars);
        if (end == content.length()) return end;
        if (Character.isHighSurrogate(content.charAt(end - 1)) && Character.isLowSurrogate(content.charAt(end))) {
            end--;
        }
        // Prefer a word boundary, retaining whitespace so concatenating chunks recreates the source exactly.
        for (int i = end - 1; i > start + maxChars / 2; i--) {
            if (Character.isWhitespace(content.charAt(i))) return i + 1;
        }
        return end;
    }
}
