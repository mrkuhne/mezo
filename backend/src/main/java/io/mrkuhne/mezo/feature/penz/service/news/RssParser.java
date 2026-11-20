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
 * {@code base44/shared/news.ts parseFeed}: regex-based on purpose (no XML parser, so no entity-expansion or DTD
 * attack surface), CDATA kept literally, other text entity-decoded, tags stripped. Extended with the summary
 * ({@code description} / {@code summary} / {@code content}) and an http(s)-only link. Anything that is not a feed
 * yields an empty list.
 */
public final class RssParser {

    /** Same as the {@code penz_news_article} columns. */
    public static final int TITLE_MAX = 300;
    public static final int SUMMARY_MAX = 600;

    private static final Pattern BLOCK = Pattern.compile("<(item|entry)\\b[^>]*>([\\s\\S]*?)</\\1>",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern CDATA_SPLIT = Pattern.compile("(<!\\[CDATA\\[[\\s\\S]*?]]>)");
    private static final Pattern TAG = Pattern.compile("<[^>]*>");
    private static final Pattern LINK_SELF_CLOSING = Pattern.compile("<link\\b([^>]*?)/>", Pattern.CASE_INSENSITIVE);
    private static final Pattern LINK_PAIRED = Pattern.compile("<link\\b([^>]*)>([\\s\\S]*?)</link>",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern WEEKDAY_PREFIX = Pattern.compile("^[A-Za-z]{3,9},\\s*");

    private RssParser() {
    }

    public static List<RssItem> parse(String xml) {
        List<RssItem> out = new ArrayList<>();
        if (xml == null || xml.isEmpty()) {
            return out;
        }
        Matcher m = BLOCK.matcher(xml);
        while (m.find()) {
            String block = m.group(2);
            String rawTitle = firstTag(block, "title");
            String title = rawTitle == null ? "" : cap(cleanText(rawTitle, true), TITLE_MAX);
            String link = pickLink(block);
            if (title.isEmpty() || !isHttp(link)) {
                continue;
            }
            String rawSummary = firstTag(block, "description", "summary", "content");
            String summary = rawSummary == null ? null : cap(cleanText(rawSummary, true), SUMMARY_MAX);
            out.add(new RssItem(title, link, summary == null || summary.isEmpty() ? null : summary,
                parseDate(firstTag(block, "pubDate", "published", "updated"))));
        }
        return out;
    }

    /** CDATA kept literally (tags stripped from it when asked), other text entity-decoded; trimmed, collapsed. */
    static String cleanText(String raw, boolean stripTags) {
        StringBuilder sb = new StringBuilder();
        Matcher m = CDATA_SPLIT.matcher(raw);
        int last = 0;
        while (m.find()) {
            sb.append(plain(raw.substring(last, m.start()), stripTags));
            String inner = m.group().substring(9, m.group().length() - 3);
            // CDATA content is HTML in practice (descriptions): strip its tags, decode its entities
            sb.append(stripTags ? NewsText.decodeEntities(TAG.matcher(inner).replaceAll(" ")) : inner);
            last = m.end();
        }
        sb.append(plain(raw.substring(last), stripTags));
        return sb.toString().replaceAll("\\s+", " ").trim();
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

    private record LinkCandidate(String href, String rel) {
    }

    private static String pickLink(String block) {
        List<LinkCandidate> cands = new ArrayList<>();
        Matcher self = LINK_SELF_CLOSING.matcher(block);
        while (self.find()) {
            String href = attr(self.group(1), "href");
            if (href != null && !href.isBlank()) {
                cands.add(new LinkCandidate(NewsText.decodeEntities(href.trim()), attr(self.group(1), "rel")));
            }
        }
        Matcher paired = LINK_PAIRED.matcher(block);
        while (paired.find()) {
            String href = attr(paired.group(1), "href");
            String value = href != null ? NewsText.decodeEntities(href.trim()) : cleanText(paired.group(2), false);
            if (!value.isEmpty()) {
                cands.add(new LinkCandidate(value, attr(paired.group(1), "rel")));
            }
        }
        return cands.stream()
            .filter(c -> c.rel() == null || c.rel().equalsIgnoreCase("alternate"))
            .map(LinkCandidate::href)
            .findFirst()
            .orElse("");
    }

    private static boolean isHttp(String link) {
        String l = link.toLowerCase(Locale.ROOT);
        return (l.startsWith("https://") || l.startsWith("http://")) && link.length() > 8 && link.length() <= 1000
            && link.chars().noneMatch(Character::isWhitespace);
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

    private static String firstTag(String block, String... names) {
        for (String n : names) {
            Matcher m = Pattern.compile("<" + n + "\\b[^>]*>([\\s\\S]*?)</" + n + ">", Pattern.CASE_INSENSITIVE)
                .matcher(block);
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static String cap(String s, int max) {
        if (s.length() <= max) {
            return s;
        }
        int cut = s.lastIndexOf(' ', max - 1);
        return (cut > max / 2 ? s.substring(0, cut) : s.substring(0, max)).trim();
    }
}
