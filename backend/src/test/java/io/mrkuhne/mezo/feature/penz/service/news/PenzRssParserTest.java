package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The feed parser (mezo-r36n9.104) — the old app's {@code parseFeed} vectors plus summaries and link hygiene. */
class PenzRssParserTest {

    private static final String RSS = """
        <?xml version="1.0"?><rss><channel><title>CNBC</title>
        <item><title><![CDATA[Fed holds <b>rates</b> & stocks rally]]></title><link>https://cnbc.com/a</link>\
        <description><![CDATA[<p>The central bank kept rates.</p>]]></description>\
        <pubDate>Tue, 04 Nov 2026 10:00:00 GMT</pubDate></item>
        <item><title>Oil &amp; gas &#39;surge&#39; &#x41;</title><link>https://cnbc.com/b</link><pubDate>garbage</pubDate></item>
        <item><title>No link</title></item>
        </channel></rss>""";

    private static final String ATOM = """
        <feed xmlns="http://www.w3.org/2005/Atom"><title>F</title>
        <entry><title>Atom one</title><link rel="self" href="https://x.com/self"/><link rel="alternate" href="https://x.com/1"/>\
        <summary>Short &amp; sweet</summary><updated>2026-11-03T08:00:00Z</updated></entry>
        <entry><title>Atom two</title><link href="https://x.com/2"/><published>2026-11-04T08:00:00Z</published></entry></feed>""";

    @Test
    void testParse_shouldReadRssWithCdataAndEntities_whenFeedIsRss() {
        List<RssItem> items = RssParser.parse(RSS);

        assertThat(items).hasSize(2);
        assertThat(items.get(0)).isEqualTo(new RssItem("Fed holds rates & stocks rally", "https://cnbc.com/a",
            "The central bank kept rates.", Instant.parse("2026-11-04T10:00:00Z")));
        assertThat(items.get(1).title()).isEqualTo("Oil & gas 'surge' A");
        assertThat(items.get(1).publishedAt()).isNull();
        assertThat(items.get(1).summary()).isNull();
    }

    @Test
    void testParse_shouldPreferAlternateLink_whenFeedIsAtom() {
        List<RssItem> items = RssParser.parse(ATOM);

        assertThat(items).extracting(RssItem::link).containsExactly("https://x.com/1", "https://x.com/2");
        assertThat(items.get(0).publishedAt()).isEqualTo(Instant.parse("2026-11-03T08:00:00Z"));
        assertThat(items.get(0).summary()).isEqualTo("Short & sweet");
        assertThat(items.get(1).publishedAt()).isEqualTo(Instant.parse("2026-11-04T08:00:00Z"));
    }

    @Test
    void testParse_shouldReturnEmpty_whenInputIsHtmlOrNull() {
        assertThat(RssParser.parse("<html><body><p>Hi</p></body></html>")).isEmpty();
        assertThat(RssParser.parse(null)).isEmpty();
        assertThat(RssParser.parse("")).isEmpty();
    }

    @Test
    void testParse_shouldDropItem_whenLinkIsNotHttp() {
        String feed = "<rss><item><title>A</title><link>javascript:alert(1)</link></item>"
            + "<item><title>B</title><link>ftp://x.com/b</link></item>"
            + "<item><title>C</title><link>http://x.com/c</link></item></rss>";

        assertThat(RssParser.parse(feed)).extracting(RssItem::link).containsExactly("http://x.com/c");
    }

    @Test
    void testParse_shouldCapSummary_whenDescriptionIsLong() {
        String feed = "<rss><item><title>A</title><link>https://x.com/a</link><description>" + "szó ".repeat(400)
            + "</description><pubDate>2026-11-04T08:00:00+01:00</pubDate></item></rss>";

        RssItem item = RssParser.parse(feed).get(0);
        assertThat(item.summary()).hasSizeLessThanOrEqualTo(RssParser.SUMMARY_MAX);
        assertThat(item.publishedAt()).isEqualTo(Instant.parse("2026-11-04T07:00:00Z"));
    }
}
