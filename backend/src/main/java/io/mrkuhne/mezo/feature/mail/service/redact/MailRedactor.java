package io.mrkuhne.mezo.feature.mail.service.redact;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Comment;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.safety.Safelist;

/**
 * Pure redaction core (spec §5.3): turns a raw mail body into text that is safe to send to a model.
 * JSON-LD blocks are pulled out of the HTML first, then the body is reduced to plain visible text, links
 * become anchor text plus a bare host, and identifiers are masked. Due dates, amounts, carrier names and
 * parcel status words are deliberately left alone.
 */
public final class MailRedactor {

    static final String MASK = "[azonosító]";

    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+");
    private static final Pattern CARD = Pattern.compile("(?<![\\d])\\d{4}(?:[ -]\\d{4}){3}(?![\\d])");
    private static final Pattern IBAN =
            Pattern.compile("\\b[A-Z]{2}\\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\\b");
    private static final Pattern HU_ACCOUNT = Pattern.compile("(?<!\\d)\\d{8}-\\d{8}(?:-\\d{8})?(?!\\d)");
    private static final Pattern REFERENCE = Pattern.compile(
            "(?iu)\\b(rendelésszám|rendelés száma|rendelés azonosító|foglalási szám|foglalás száma|számlaszám"
                    + "|számla száma|számlaazonosító|order(?: number| no\\.?| id)?|booking(?: number| ref(?:erence)?)?"
                    + "|invoice(?: number| no\\.?)?|reference|referencia|azonosító)(\\s*[:#]?\\s*)"
                    + "(?=[A-Za-z0-9/-]*\\d)[A-Za-z0-9/-]{4,}");
    private static final Pattern PHONE = Pattern.compile(
            "(?<![\\w+])(?:(?:\\+|00)\\d{1,3}[\\s./-]?\\(?\\d{1,3}\\)?(?:[\\s./-]?\\d{2,4}){2,4}"
                    + "|06[\\s./-]?\\d{1,2}[\\s./-]\\d{3}[\\s./-]\\d{3,4})(?!\\d)");
    private static final Pattern LONG_DIGITS = Pattern.compile("\\d{8,}");
    private static final Pattern BARE_URL = Pattern.compile("https?://[^\\s<>\"')\\]]+");

    private MailRedactor() {}

    public static RedactedMail redact(String plain, String html, int maxChars) {
        List<String> jsonLd = new ArrayList<>();
        Set<String> hosts = new LinkedHashSet<>();
        String text = null;

        Document doc = null;
        if (html != null && !html.isBlank()) {
            doc = Jsoup.parse(html);
            for (Element script : doc.select("script[type=application/ld+json]")) {
                String block = script.data().strip();
                if (!block.isEmpty()) {
                    jsonLd.add(block);
                }
            }
        }

        if (plain != null && !plain.isBlank()) {
            text = replaceBareUrls(plain, hosts);
        } else if (doc != null) {
            text = htmlToText(doc, hosts);
        }
        if (text == null) {
            return new RedactedMail("", List.of(), jsonLd);
        }

        String masked = mask(normalizeWhitespace(text));
        if (maxChars >= 0 && masked.length() > maxChars) {
            masked = masked.substring(0, maxChars).stripTrailing();
        }
        return new RedactedMail(masked, new ArrayList<>(hosts), jsonLd);
    }

    private static String htmlToText(Document doc, Set<String> hosts) {
        doc.select("head, style, script, noscript, img, picture, svg, video, audio, iframe").remove();
        removeComments(doc);
        for (Element a : doc.select("a[href]")) {
            String host = hostOf(a.attr("href"));
            if (host != null) {
                hosts.add(host);
                String label = a.text().strip();
                a.text(label.isEmpty() ? host : label + " (" + host + ")");
            }
        }
        doc.select("br").after("\n");
        doc.select("p, div, tr, li, h1, h2, h3, h4, h5, h6, table, ul, ol, blockquote, hr").append("\n");
        doc.select("td, th").append(" ");
        String visible = Jsoup.clean(doc.body().wholeText(), "", Safelist.none(),
                new Document.OutputSettings().prettyPrint(false));
        return Jsoup.parse(visible).text(visible).wholeText();
    }

    private static void removeComments(Node node) {
        for (Node child : new ArrayList<>(node.childNodes())) {
            if (child instanceof Comment) {
                child.remove();
            } else {
                removeComments(child);
            }
        }
    }

    private static String replaceBareUrls(String plain, Set<String> hosts) {
        Matcher m = BARE_URL.matcher(plain);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String host = hostOf(m.group());
            if (host != null) {
                hosts.add(host);
            }
            m.appendReplacement(out, Matcher.quoteReplacement(host == null ? "" : host));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static String hostOf(String url) {
        try {
            String host = URI.create(url.strip()).getHost();
            return host == null ? null : host.toLowerCase(Locale.ROOT);
        } catch (java.lang.IllegalArgumentException e) {
            return null;
        }
    }

    private static String normalizeWhitespace(String s) {
        String t = s.replace(' ', ' ').replace("\r", "");
        t = t.replaceAll("[ \\t\\f]+", " ");
        t = t.replaceAll(" ?\\n ?", "\n");
        t = t.replaceAll("\\n{3,}", "\n\n");
        return t.strip();
    }

    static String mask(String s) {
        String t = EMAIL.matcher(s).replaceAll(MASK);
        t = IBAN.matcher(t).replaceAll(MASK);
        t = CARD.matcher(t).replaceAll(MASK);
        t = HU_ACCOUNT.matcher(t).replaceAll(MASK);
        t = REFERENCE.matcher(t).replaceAll(r -> Matcher.quoteReplacement(r.group(1) + r.group(2) + MASK));
        t = PHONE.matcher(t).replaceAll(MASK);
        t = LONG_DIGITS.matcher(t).replaceAll(MASK);
        return t;
    }
}
