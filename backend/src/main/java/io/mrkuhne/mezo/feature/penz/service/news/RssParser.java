package io.mrkuhne.mezo.feature.penz.service.news;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * RSS {@code <item>} + Atom {@code <entry>} parser (Boop Pénz L6, mezo-r36n9.104) — a port of the old app's
 * {@code base44/shared/news.ts parseFeed}: no XML parser on purpose (no entity-expansion or DTD surface), CDATA kept
 * literally, other text entity-decoded, tags stripped. Extended with the summary ({@code description} /
 * {@code summary} / {@code content}) and an http(s)-only link. Anything that is not a feed yields an empty list.
 *
 * <p><b>Linear by construction</b> (security review #5): the input is cut to {@link #MAX_INPUT_CHARS}, blocks, tags,
 * links and CDATA sections are found with {@code indexOf} scans that never revisit text (an open tag without its
 * close ends the scan), and the only regexes left run over bounded attribute strings or use {@code <[^<>]*>}, which
 * cannot backtrack across a run of {@code <}. Every output string goes through {@link NewsText#clean} (review #6).
 */
public final class RssParser {

    /** Same as the {@code penz_news_article} columns. */
    public static final int TITLE_MAX = 300;
    public static final int SUMMARY_MAX = 600;
    /** Only the first 512 KB of a feed is parsed (the newest items come first). */
    public static final int MAX_INPUT_CHARS = 512 * 1024;

    private static final Pattern TAG = Pattern.compile("<[^<>]*>");
    private static final Pattern WEEKDAY_PREFIX = Pattern.compile("^[A-Za-z]{3,9},\\s*");

    private RssParser() {
    }

    public static List<RssItem> parse(String xml) {
        List<RssItem> out = new ArrayList<>();
        if (xml == null || xml.isEmpty()) {
            return out;
        }
        String src = xml.length() > MAX_INPUT_CHARS ? xml.substring(0, MAX_INPUT_CHARS) : xml;
        String lower = asciiLower(src);
        int from = 0;
        while (true) {
            int[] open = nextOpen(lower, from, "item", "entry");
            if (open == null) {
                break;
            }
            String name = lower.startsWith("<item", open[0]) ? "item" : "entry";
            int close = lower.indexOf("</" + name, open[1]);
            if (close < 0) {
                break; // no close anywhere after: nothing more can match
            }
            String block = src.substring(open[1], close);
            from = close + name.length() + 2;
            RssItem item = item(block, asciiLower(block));
            if (item != null) {
                out.add(item);
            }
        }
        return out;
    }

    private static RssItem item(String block, String lower) {
        String rawTitle = firstTag(block, lower, "title");
        String title = rawTitle == null ? "" : cap(cleanText(rawTitle, true), TITLE_MAX);
        String link = pickLink(block, lower);
        if (title.isEmpty() || !isHttp(link)) {
            return null;
        }
        String rawSummary = firstTag(block, lower, "description", "summary", "content");
        String summary = rawSummary == null ? null : cap(cleanText(rawSummary, true), SUMMARY_MAX);
        return new RssItem(title, link, summary == null || summary.isEmpty() ? null : summary,
            parseDate(firstTag(block, lower, "pubdate", "published", "updated")));
    }

    /**
     * The next {@code <name} (one of {@code names}) followed by whitespace, {@code >} or {@code /}, at or after
     * {@code from}: {start, index after the open tag's {@code >}}; null when none (or the open tag never ends).
     */
    private static int[] nextOpen(String lower, int from, String... names) {
        int i = lower.indexOf('<', from);
        while (i >= 0) {
            for (String n : names) {
                int after = i + n.length() + 1;
                if (lower.startsWith(n, i + 1)) {
                    char c = after < lower.length() ? lower.charAt(after) : '>';
                    if (c == '>' || c == '/' || Character.isWhitespace(c)) {
                        int gt = indexOfTagEnd(lower, after);
                        return gt < 0 ? null : new int[] {i, gt + 1};
                    }
                }
            }
            i = lower.indexOf('<', i + 1);
        }
        return null;
    }

    /** The {@code >} closing a tag that started before {@code from}, or -1 when a {@code <} comes first / none. */
    private static int indexOfTagEnd(String s, int from) {
        for (int i = from; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '>') {
                return i;
            }
            if (c == '<') {
                return -1;
            }
        }
        return -1;
    }

    /** The raw content of the first {@code <name …>…</name>} of {@code names} present; null when none. */
    private static String firstTag(String block, String lower, String... names) {
        for (String n : names) {
            int[] open = nextOpen(lower, 0, n);
            if (open == null) {
                continue;
            }
            int close = lower.indexOf("</" + n, open[1]);
            if (close >= 0) {
                return block.substring(open[1], close);
            }
        }
        return null;
    }

    /** CDATA kept literally (tags stripped from it when asked), other text entity-decoded; trimmed, collapsed. */
    static String cleanText(String raw, boolean stripTags) {
        StringBuilder sb = new StringBuilder();
        int at = 0;
        while (true) {
            int start = raw.indexOf("<![CDATA[", at);
            if (start < 0) {
                break;
            }
            int end = raw.indexOf("]]>", start + 9);
            if (end < 0) {
                break; // an unterminated CDATA is plain text from here on
            }
            sb.append(plain(raw.substring(at, start), stripTags));
            String inner = raw.substring(start + 9, end);
            sb.append(stripTags ? NewsText.decodeEntities(TAG.matcher(inner).replaceAll(" ")) : inner);
            at = end + 3;
        }
        sb.append(plain(raw.substring(at), stripTags));
        return NewsText.clean(sb.toString()).replaceAll("\\s+", " ").trim();
    }

    private static String plain(String part, boolean stripTags) {
        String decoded = NewsText.decodeEntities(stripTags ? TAG.matcher(part).replaceAll("") : part);
        // an escaped-HTML description (&lt;p&gt;) decodes into tags: strip those too
        return stripTags ? TAG.matcher(decoded).replaceAll(" ") : decoded;
    }

    private static String attr(String attrs, String name) {
        Matcher m = Pattern.compile("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')",
            Pattern.CASE_INSENSITIVE).matcher(attrs);
        if (!m.find()) {
            return null;
        }
        return m.group(1) != null ? m.group(1) : m.group(2);
    }

    /** Every {@code <link>} of the block in order: the first with no rel or rel=alternate wins. */
    private static String pickLink(String block, String lower) {
        int at = 0;
        while (true) {
            int[] open = nextOpen(lower, at, "link");
            if (open == null) {
                return "";
            }
            String attrs = block.substring(open[0] + 5, open[1] - 1);
            boolean selfClosing = attrs.endsWith("/");
            String href = attr(attrs, "href");
            String rel = attr(attrs, "rel");
            String value;
            if (href != null) {
                value = NewsText.decodeEntities(href.trim());
                at = open[1];
            } else if (selfClosing) {
                value = "";
                at = open[1];
            } else {
                int close = lower.indexOf("</link", open[1]);
                if (close < 0) {
                    return "";
                }
                value = linkText(block.substring(open[1], close));
                at = close + 6;
            }
            if (!value.isEmpty() && (rel == null || rel.equalsIgnoreCase("alternate"))) {
                return value;
            }
        }
    }

    /**
     * A link element's text: CDATA unwrapped, entities decoded, trimmed — NOT cleaned, so a link carrying a control
     * or format character is refused by {@link #isHttp} instead of being silently repaired into another url.
     */
    private static String linkText(String raw) {
        String t = raw.strip();
        if (t.startsWith("<![CDATA[") && t.endsWith("]]>")) {
            t = t.substring(9, t.length() - 3);
        }
        return NewsText.decodeEntities(t).strip();
    }

    private static boolean isHttp(String link) {
        String l = link.toLowerCase(Locale.ROOT);
        return (l.startsWith("https://") || l.startsWith("http://")) && link.length() > 8 && link.length() <= 1000
            && link.chars().noneMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c)
                || Character.getType(c) == Character.FORMAT || Character.isSurrogate((char) c));
    }

    private static Instant parseDate(String raw) {
        if (raw == null) {
            return null;
        }
        String s = cleanText(raw, false);
        try {
            return OffsetDateTime.parse(s).toInstant();
        } catch (DateTimeParseException ignored) {
            // not ISO-8601 — try RFC 1123 below
        }
        try {
            // the weekday is dropped: feeds get it wrong, and a wrong weekday must not lose the date
            return ZonedDateTime.parse(WEEKDAY_PREFIX.matcher(s).replaceFirst(""), DateTimeFormatter.RFC_1123_DATE_TIME)
                .toInstant();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    /** ASCII-only lower case: same length as the input, so indexes carry over. */
    private static String asciiLower(String s) {
        char[] c = s.toCharArray();
        for (int i = 0; i < c.length; i++) {
            if (c[i] >= 'A' && c[i] <= 'Z') {
                c[i] = (char) (c[i] + 32);
            }
        }
        return new String(c);
    }

    private static String cap(String s, int max) {
        if (s.length() <= max) {
            return s;
        }
        int cut = s.lastIndexOf(' ', max - 1);
        return (cut > max / 2 ? s.substring(0, cut) : s.substring(0, max)).trim();
    }
}
