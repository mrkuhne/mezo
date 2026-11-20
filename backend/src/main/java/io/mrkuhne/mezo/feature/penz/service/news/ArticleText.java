package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Article HTML → plain text (Boop Pénz L6, mezo-r36n9.104) — a port of the old app's {@code base44/shared/article.ts
 * htmlToText}: page chrome dropped ({@code script style noscript nav header footer aside form}), the {@code <article>}
 * elements preferred when present, tags stripped, entities decoded, whitespace collapsed, cut to {@link #MAX_CHARS}
 * (the old 12 000 lowered to 4 000: up to 12 bodies share one prompt). Under {@link #MIN_CHARS} it is a paywall or
 * a stub, not a body.
 */
public final class ArticleText {

    public static final int MAX_CHARS = 4_000;
    public static final int MIN_CHARS = 600;

    private static final List<Pattern> DROP = new ArrayList<>();
    private static final Pattern ARTICLE = Pattern.compile("<article\\b[^>]*>([\\s\\S]*?)</article\\s*>",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern TAG = Pattern.compile("<[^>]*>");
    private static final Pattern COMMENT = Pattern.compile("<!--[\\s\\S]*?-->");

    static {
        for (String t : List.of("script", "style", "noscript", "nav", "header", "footer", "aside", "form")) {
            DROP.add(Pattern.compile("<" + t + "\\b[^>]*>[\\s\\S]*?</" + t + "\\s*>", Pattern.CASE_INSENSITIVE));
        }
    }

    private ArticleText() {
    }

    /** The page's text, at most {@link #MAX_CHARS} characters; null → empty. */
    public static String fromHtml(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }
        String h = COMMENT.matcher(html).replaceAll(" ");
        for (Pattern p : DROP) {
            h = p.matcher(h).replaceAll(" ");
        }
        Matcher m = ARTICLE.matcher(h);
        List<String> articles = new ArrayList<>();
        while (m.find()) {
            articles.add(m.group(1));
        }
        if (!articles.isEmpty()) {
            h = String.join(" ", articles);
        }
        String text = NewsText.decodeEntities(TAG.matcher(h).replaceAll(" ")).replaceAll("\\s+", " ").trim();
        return text.length() > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;
    }

    /** {@link #fromHtml}, or empty when the text is shorter than {@link #MIN_CHARS} (no usable body). */
    public static Optional<String> body(String html) {
        String text = fromHtml(html);
        return text.length() < MIN_CHARS ? Optional.empty() : Optional.of(text);
    }
}
