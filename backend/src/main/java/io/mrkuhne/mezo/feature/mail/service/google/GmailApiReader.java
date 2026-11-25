package io.mrkuhne.mezo.feature.mail.service.google;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.MailErrors;
import io.mrkuhne.mezo.feature.mail.service.imap.FetchedMail;
import io.mrkuhne.mezo.feature.mail.service.imap.MimeMailExtractor;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the owner's Inbox and Spam through the Gmail REST API with the read-only scope (spec §12.2); it never writes
 * to the mailbox (only GETs). First run (cursor 0) and a history that expired (HTTP 404) read the last 7 days of
 * each label, at most {@code max} per label; later runs follow {@code users.history.list} for added messages. Each
 * message is fetched as {@code format=raw} and goes through the same MIME extraction as IMAP
 * ({@link MimeMailExtractor}), so redaction, rules and the pipeline are shared. The access token is only ever put
 * in the Authorization header; it is never logged.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class GmailApiReader {

    /** The mails of one run, oldest label order first, and the history id the next run continues from. */
    public record GmailBatch(long historyId, List<FetchedMail> mails) {
    }

    public static final String SPAM_FOLDER = "[Gmail]/Spam";
    public static final String INBOX_FOLDER = "INBOX";

    private static final String INBOX = "INBOX";
    private static final String SPAM = "SPAM";
    private static final Logger LOG = LoggerFactory.getLogger(GmailApiReader.class);
    private static final tools.jackson.databind.ObjectMapper JSON = JsonMapper.builder().build();
    private static final int PAGE = 100;

    private final MailProperties.Google google;
    private final Clock clock;
    private final RestClient rest;

    @Autowired
    public GmailApiReader(MailProperties properties) {
        this(properties.google(), Clock.systemUTC());
    }

    GmailApiReader(MailProperties.Google google, Clock clock) {
        this.google = google;
        this.clock = clock;
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withTimeouts(GoogleOAuthClient.TIMEOUT, GoogleOAuthClient.TIMEOUT);
        this.rest = RestClient.builder().requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .baseUrl(google.apiUrl()).build();
    }

    /**
     * @param sinceHistoryId the stored cursor; 0 on the first run
     * @param max            the per-label cap of one run
     */
    public GmailBatch read(String accessToken, long sinceHistoryId, int max) {
        if (sinceHistoryId <= 0) {
            return fullSync(accessToken, max);
        }
        GmailBatch batch = incremental(accessToken, sinceHistoryId, max);
        if (batch == null) { // the history id is too old (HTTP 404)
            LOG.info("gmail history expired, bounded full sync");
            return fullSync(accessToken, max);
        }
        return batch;
    }

    private GmailBatch fullSync(String token, int max) {
        long historyId = orUnreachable(get(token, uri -> uri.path("/users/me/profile").build()))
            .path("historyId").asLong(0); // read BEFORE listing, so nothing slips between (dupes are idempotent)
        Map<String, String> ids = new LinkedHashMap<>(); // id to label
        for (String label : List.of(INBOX, SPAM)) {
            String page = null;
            int taken = 0;
            do {
                final String pageToken = page;
                JsonNode body = orUnreachable(get(token, uri -> {
                    uri.path("/users/me/messages").queryParam("q", "newer_than:7d").queryParam("labelIds", label)
                        .queryParam("maxResults", PAGE);
                    if (pageToken != null) {
                        uri.queryParam("pageToken", pageToken);
                    }
                    return uri.build();
                }));
                for (JsonNode m : body.path("messages")) {
                    if (taken < max) {
                        ids.putIfAbsent(m.path("id").asString(), label);
                        taken++;
                    }
                }
                page = taken < max ? nextPage(body) : null;
            } while (page != null);
        }
        return new GmailBatch(historyId, fetchAll(token, ids));
    }

    /** Null when the history id is too old (404). */
    private GmailBatch incremental(String token, long since, int max) {
        Map<String, String> ids = new LinkedHashMap<>();
        int[] taken = new int[2]; // inbox, spam
        long newest = since;
        long consumed = since;
        boolean capped = false;
        String page = null;
        outer:
        do {
            final String pageToken = page;
            JsonNode body = getHistory(token, since, pageToken);
            if (body == null) {
                return null;
            }
            newest = Math.max(newest, body.path("historyId").asLong(since));
            for (JsonNode record : body.path("history")) {
                long id = record.path("id").asLong(0);
                for (JsonNode added : record.path("messagesAdded")) {
                    JsonNode message = added.path("message");
                    String label = labelOf(message.path("labelIds"));
                    if (label == null) {
                        continue;
                    }
                    int slot = SPAM.equals(label) ? 1 : 0;
                    if (taken[slot] >= max) {
                        capped = true;
                        break outer;
                    }
                    if (ids.putIfAbsent(message.path("id").asString(), label) == null) {
                        taken[slot]++;
                    }
                }
                consumed = Math.max(consumed, id);
            }
            page = nextPage(body);
        } while (page != null);
        long next = capped ? consumed : newest; // when capped, resume after the last fully taken record
        return new GmailBatch(Math.max(next, since), fetchAll(token, ids));
    }

    private JsonNode getHistory(String token, long since, String pageToken) {
        return get(token, uri -> {
            uri.path("/users/me/history").queryParam("startHistoryId", since)
                .queryParam("historyTypes", "messageAdded").queryParam("maxResults", 500);
            if (pageToken != null) {
                uri.queryParam("pageToken", pageToken);
            }
            return uri.build();
        });
    }

    private static String labelOf(JsonNode labels) {
        boolean inbox = false;
        for (JsonNode l : labels) {
            if (SPAM.equals(l.asString())) {
                return SPAM;
            }
            inbox |= INBOX.equals(l.asString());
        }
        return inbox ? INBOX : null;
    }

    private static String nextPage(JsonNode body) {
        String t = body.path("nextPageToken").asString("");
        return t.isEmpty() ? null : t;
    }

    /** A list/profile call never legitimately answers 404. */
    private static JsonNode orUnreachable(JsonNode body) {
        if (body == null) {
            throw MailErrors.unreachable();
        }
        return body;
    }

    private List<FetchedMail> fetchAll(String token, Map<String, String> ids) {
        List<FetchedMail> mails = new ArrayList<>();
        for (Map.Entry<String, String> e : ids.entrySet()) {
            FetchedMail mail = fetchOne(token, e.getKey());
            if (mail != null) {
                mails.add(mail);
            }
        }
        return mails;
    }

    /** One message as raw MIME; a message deleted since it was listed (404) is skipped. */
    private FetchedMail fetchOne(String token, String id) {
        JsonNode body = get(token, uri -> uri.path("/users/me/messages/{id}").queryParam("format", "raw").build(id));
        if (body == null) {
            return null;
        }
        String raw = body.path("raw").asString("");
        MimeMessage mime;
        try {
            mime = new MimeMessage(Session.getInstance(new Properties()),
                new ByteArrayInputStream(Base64.getUrlDecoder().decode(raw)));
        } catch (MessagingException | IllegalArgumentException e) {
            LOG.warn("gmail message {} unreadable: {}", id, e.getClass().getSimpleName());
            return null; // one bad message never fails the run
        }
        String folder = SPAM.equals(labelOf(body.path("labelIds"))) ? SPAM_FOLDER : INBOX_FOLDER;
        Instant received = body.has("internalDate") ? Instant.ofEpochMilli(body.path("internalDate").asLong()) : null;
        Long gm = parseGmId(id);
        return MimeMailExtractor.toMail(folder, 0, 0, gm, mime, received, clock);
    }

    private static Long parseGmId(String id) {
        try {
            return Long.parseUnsignedLong(id, 16);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** A GET with the bearer token; null on a 404 (the caller decides), 401/403 is auth failed, the rest unreachable. */
    private JsonNode get(String token, java.util.function.Function<org.springframework.web.util.UriBuilder,
        java.net.URI> uri) {
        try {
            String raw = rest.get().uri(uri::apply).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .retrieve().body(String.class);
            return JSON.readTree(raw == null ? "{}" : raw);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            if (status == 404) {
                return null;
            }
            LOG.warn("gmail api answered {}", status);
            if (status == 401 || status == 403) {
                throw MailErrors.authFailed();
            }
            throw MailErrors.unreachable();
        } catch (RestClientException | JacksonException e) {
            LOG.warn("gmail api unreachable: {}", e.getClass().getSimpleName());
            throw MailErrors.unreachable();
        }
    }
}
