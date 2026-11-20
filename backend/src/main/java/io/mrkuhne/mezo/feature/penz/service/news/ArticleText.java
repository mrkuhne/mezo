package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.select.NodeTraversor;
import org.jsoup.select.NodeVisitor;

/**
 * Article HTML → plain text (Boop Pénz L6, mezo-r36n9.104) — the old app's {@code base44/shared/article.ts
 * htmlToText} rules (page chrome dropped: {@code script style noscript nav header footer aside form}; the
 * {@code <article>} elements preferred when present; entities decoded; whitespace collapsed), cut to
 * {@link #MAX_CHARS} (the old 12 000 lowered to 4 000: up to 12 bodies share one prompt). Under {@link #MIN_CHARS} it
 * is a paywall or a stub, not a body.
 *
 * <p>Security review #5 / #6: the page is cut to {@link #MAX_INPUT_CHARS} and cleaned of control / format characters
 * first, then parsed by jsoup — a real HTML tokenizer, linear in its input — instead of the old regexes, which went
 * quadratic on a run of {@code <}.
 */
public final class ArticleText {

    public static final int MAX_CHARS = 4_000;
    public static final int MIN_CHARS = 600;
    /** Only the first 256 KB of a page is read. */
    public static final int MAX_INPUT_CHARS = 256 * 1024;

    private static final String CHROME = "script, style, noscript, nav, header, footer, aside, form";

    private ArticleText() {
    }

    /** The page's text, at most {@link #MAX_CHARS} characters; null → empty. */
    public static String fromHtml(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }
        String src = NewsText.clean(html.length() > MAX_INPUT_CHARS ? html.substring(0, MAX_INPUT_CHARS) : html);
        Document doc = Jsoup.parse(src);
        doc.select(CHROME).remove();
        List<Element> articles = topLevelArticles(doc);
        String raw = articles.isEmpty()
            ? doc.text()
            : articles.stream().map(Element::text).collect(Collectors.joining(" "));
        String text = NewsText.clean(raw).replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
        return text.length() > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;
    }

    /** The {@code <article>} elements not inside another one, in document order — one pass, any nesting depth. */
    private static List<Element> topLevelArticles(Document doc) {
        List<Element> out = new ArrayList<>();
        int[] depth = {0};
        NodeTraversor.traverse(new NodeVisitor() {
            @Override
            public void head(Node node, int d) {
                if (node instanceof Element e && "article".equals(e.normalName())) {
                    if (depth[0] == 0) {
                        out.add(e);
                    }
                    depth[0]++;
                }
            }

            @Override
            public void tail(Node node, int d) {
                if (node instanceof Element e && "article".equals(e.normalName())) {
                    depth[0]--;
                }
            }
        }, doc);
        return out;
    }

    /** {@link #fromHtml}, or empty when the text is shorter than {@link #MIN_CHARS} (no usable body). */
    public static Optional<String> body(String html) {
        String text = fromHtml(html);
        return text.length() < MIN_CHARS ? Optional.empty() : Optional.of(text);
    }
}
