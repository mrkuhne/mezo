package io.mrkuhne.mezo.feature.mail.service.imap;

import io.mrkuhne.mezo.feature.mail.service.rules.MailHeaders;
import jakarta.mail.Header;
import jakarta.mail.MessagingException;
import jakarta.mail.Part;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The MIME to {@link FetchedMail} extraction shared by the IMAP reader and the Gmail API reader: headers, first
 * text/plain and text/html parts (attachments are never opened), a degraded result for a malformed message.
 */
public final class MimeMailExtractor {

    private static final Logger LOG = LoggerFactory.getLogger(MimeMailExtractor.class);
    private static final int BODY_CHAR_CAP = 500_000;

    private MimeMailExtractor() {
    }

    /**
     * One bad message degrades to what could be read; it never fails the batch. {@code receivedOverride} (when not
     * null) wins over the message's own dates, e.g. Gmail's {@code internalDate}.
     */
    public static FetchedMail toMail(String folder, long uid, long validity, Long gmMsgId, MimeMessage m,
                                     Instant receivedOverride, Clock clock) {
        Map<String, List<String>> raw = new LinkedHashMap<>();
        try {
            Enumeration<Header> all = m.getAllHeaders();
            while (all.hasMoreElements()) {
                Header h = all.nextElement();
                raw.computeIfAbsent(h.getName(), k -> new ArrayList<>()).add(h.getValue());
            }
        } catch (MessagingException | RuntimeException e) {
            LOG.debug("mail uid {}: headers unreadable", uid);
        }
        String from = "";
        String fromName = "";
        try {
            jakarta.mail.Address[] addrs = m.getFrom();
            if (addrs != null && addrs.length > 0) {
                if (addrs[0] instanceof InternetAddress ia) {
                    from = ia.getAddress() == null ? "" : ia.getAddress();
                    fromName = ia.getPersonal() == null ? "" : ia.getPersonal();
                } else {
                    from = addrs[0].toString();
                }
            }
        } catch (MessagingException | RuntimeException e) {
            LOG.debug("mail uid {}: From unreadable", uid);
        }
        String subject = null; // MailHeaders turns null into ""
        try {
            subject = m.getSubject();
        } catch (MessagingException | RuntimeException e) {
            LOG.debug("mail uid {}: Subject unreadable", uid);
        }
        if (subject == null || subject.isEmpty()) { // envelope unusable: decode the raw header instead
            List<String> rawSubject = raw.getOrDefault("Subject", List.of());
            if (!rawSubject.isEmpty() && rawSubject.get(0) != null) {
                try {
                    subject = jakarta.mail.internet.MimeUtility.decodeText(rawSubject.get(0).strip());
                } catch (java.io.UnsupportedEncodingException e) {
                    subject = rawSubject.get(0).strip();
                }
            }
        }
        MailHeaders headers = new MailHeaders(from, fromName, subject, raw);
        List<String> ids = headers.values("Message-ID");
        String messageId = ids.isEmpty() || ids.get(0) == null ? "" : ids.get(0).strip();
        Date received = null;
        try {
            received = m.getReceivedDate() != null ? m.getReceivedDate() : m.getSentDate();
        } catch (MessagingException | RuntimeException e) {
            LOG.debug("mail uid {}: date unreadable", uid);
        }
        Instant at = receivedOverride != null ? receivedOverride
            : received == null ? Instant.now(clock) : received.toInstant();
        String[] bodies = new String[2];
        try {
            collect(m, bodies);
        } catch (MessagingException | IOException | RuntimeException e) {
            // headers-only / partial mail; the exception text is not logged (it could echo content)
            LOG.debug("mail uid {}: body unreadable ({})", uid, e.getClass().getSimpleName());
        }
        return new FetchedMail(folder, uid, validity, gmMsgId, messageId, at, headers, bodies[0], bodies[1]);
    }

    /** First text/plain into {@code out[0]}, first text/html into {@code out[1]}; attachments are never opened. */
    private static void collect(Part part, String[] out) throws MessagingException, IOException {
        if (out[0] != null && out[1] != null) {
            return;
        }
        if (isAttachment(part)) {
            return;
        }
        if (part.isMimeType("multipart/*")) {
            jakarta.mail.Multipart mp = (jakarta.mail.Multipart) part.getContent();
            for (int i = 0; i < mp.getCount(); i++) {
                collect(mp.getBodyPart(i), out);
            }
        } else if (part.isMimeType("text/plain") && out[0] == null) {
            out[0] = cap(text(part));
        } else if (part.isMimeType("text/html") && out[1] == null) {
            out[1] = cap(text(part));
        }
    }

    private static boolean isAttachment(Part part) throws MessagingException {
        String d = part.getDisposition();
        return Part.ATTACHMENT.equalsIgnoreCase(d) || (part.getFileName() != null && !part.isMimeType("multipart/*"));
    }

    private static String text(Part part) throws MessagingException, IOException {
        try {
            Object c = part.getContent();
            return c instanceof String s ? s : "";
        } catch (java.io.UnsupportedEncodingException e) {
            try (InputStream in = part.getInputStream()) {
                return new String(in.readNBytes(BODY_CHAR_CAP), StandardCharsets.UTF_8);
            }
        }
    }

    private static String cap(String s) {
        return s.length() > BODY_CHAR_CAP ? s.substring(0, BODY_CHAR_CAP) : s;
    }
}
