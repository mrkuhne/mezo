package io.mrkuhne.mezo.feature.mail.service.classify;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Untrusted-text hygiene shared by the three mail prompts: mail text is never an instruction, so before it enters a
 * {@code <<<MAIL … MAIL>>>} fence it is neutralised (the {@code DigestPrompt.sanitizeUntrusted} rules, copied because
 * mail must not import penz): NFKC-normalised, invisible format / control characters removed, runs of two or more
 * angle marks replaced by one guillemet so no body can close its own fence or open a fake one, whitespace collapsed to
 * one line so no body can start a fake header line.
 */
final class MailFence {

    static final String OPEN = "<<<MAIL";
    static final String CLOSE = "MAIL>>>";

    private static final Pattern INVISIBLE = Pattern.compile("[\\p{Cf}\\p{Cc}\\p{Cs}&&[^\\n\\t]]");
    private static final Pattern OPEN_RUN = Pattern.compile("[<‹＜﹤](?:\\s*[<‹＜﹤])+");
    private static final Pattern CLOSE_RUN = Pattern.compile("[>›＞﹥](?:\\s*[>›＞﹥])+");

    private MailFence() {}

    static String sanitizeUntrusted(String s) {
        if (s == null) {
            return "";
        }
        String t = INVISIBLE.matcher(Normalizer.normalize(s, Normalizer.Form.NFKC)).replaceAll("");
        t = OPEN_RUN.matcher(t).replaceAll("‹");
        t = CLOSE_RUN.matcher(t).replaceAll("›");
        return t.replaceAll("\\s+", " ").strip();
    }

    static String oneLine(String s, int max) {
        String t = sanitizeUntrusted(s);
        return t.length() > max ? t.substring(0, max).strip() : t;
    }

    /** {@code header} (already neutral, may be empty) and the sanitized lines between the fence marks. */
    static String fence(String header, String sanitizedContent) {
        return OPEN + (header.isEmpty() ? "" : " " + header) + "\n" + sanitizedContent + "\n" + CLOSE + "\n";
    }
}
