package io.mrkuhne.mezo.feature.mail.service.imap;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.rules.MailHeaders;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.FetchProfile;
import jakarta.mail.Folder;
import jakarta.mail.FolderNotFoundException;
import jakarta.mail.Header;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.UIDFolder;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.search.ComparisonTerm;
import jakarta.mail.search.ReceivedDateTerm;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.eclipse.angus.mail.iap.Response;
import org.eclipse.angus.mail.imap.IMAPFolder;
import org.eclipse.angus.mail.imap.IMAPStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The IMAPS reader (spec §5.1, §8): TLS, 20 s timeouts, folders opened {@link Folder#READ_ONLY} with
 * {@code BODY.PEEK}, so nothing is ever written to the mailbox. The password is used only for the login; it is
 * never logged and never put in an exception.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class ImapMailReader implements MailReader {

    public static final String AUTH_FAILED = io.mrkuhne.mezo.feature.mail.service.MailErrors.AUTH_FAILED;
    public static final String UNREACHABLE = io.mrkuhne.mezo.feature.mail.service.MailErrors.UNREACHABLE;

    private static final String TIMEOUT_MS = "20000";
    private static final Duration FIRST_RUN_WINDOW = Duration.ofDays(7);
    private static final Logger LOG = LoggerFactory.getLogger(ImapMailReader.class);
    private static final Pattern GM_MSGID = Pattern.compile("X-GM-MSGID\\s+(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern UID_ITEM = Pattern.compile("\\bUID\\s+(\\d+)", Pattern.CASE_INSENSITIVE);

    private final MailProperties properties;
    private final Properties extraSession;
    private final Clock clock;

    @Autowired
    public ImapMailReader(MailProperties properties) {
        this(properties, new Properties(), Clock.systemUTC());
    }

    /** {@code extraSession} lets a test add session properties (e.g. trust of a self-signed certificate). */
    ImapMailReader(MailProperties properties, Properties extraSession, Clock clock) {
        this.clock = clock;
        this.properties = properties;
        this.extraSession = extraSession;
    }

    @Override
    public void verify(String address, String password) {
        try (Store store = connect(address, password)) {
            store.isConnected();
        } catch (MessagingException e) {
            throw translate(e);
        }
    }

    @Override
    public FolderBatch fetch(String address, String password, String folderName, FolderState since, int max) {
        try (Store store = connect(address, password)) {
            Folder folder = store.getFolder(folderName);
            if (!folder.exists()) {
                return new FolderBatch(since.uidValidity(), List.of());
            }
            try {
                folder.open(Folder.READ_ONLY);
            } catch (FolderNotFoundException e) {
                return new FolderBatch(since.uidValidity(), List.of());
            }
            try {
                return read(store, (IMAPFolder) folder, folderName, since, max);
            } finally {
                closeQuietly(folder);
            }
        } catch (MessagingException e) {
            throw translate(e);
        }
    }

    private FolderBatch read(Store store, IMAPFolder folder, String folderName, FolderState since, int max)
            throws MessagingException {
        long validity = folder.getUIDValidity();
        boolean fresh0 = since.uidValidity() != validity || since.lastUid() <= 0;
        long last = fresh0 ? 0L : since.lastUid();
        Message[] found;
        if (fresh0) { // first run or UIDVALIDITY changed: only the last 7 days, never the whole folder
            Date from = Date.from(clock.instant().minus(FIRST_RUN_WINDOW));
            found = folder.search(new ReceivedDateTerm(ComparisonTerm.GE, from));
        } else {
            found = folder.getMessagesByUID(last + 1, UIDFolder.LASTUID);
        }
        FetchProfile uids = new FetchProfile();
        uids.add(UIDFolder.FetchProfileItem.UID);
        folder.fetch(found, uids); // one round trip; the sort below then reads cached UIDs
        List<Message> fresh = new ArrayList<>();
        for (Message m : found) {
            if (m != null && folder.getUID(m) > last) { // "n:*" always yields the newest, even below the range
                fresh.add(m);
            }
        }
        fresh.sort((a, b) -> Long.compare(uidOf(folder, a), uidOf(folder, b)));
        List<Message> batch = fresh.subList(0, Math.min(Math.max(max, 0), fresh.size()));
        if (batch.isEmpty()) {
            return new FolderBatch(validity, List.of());
        }
        FetchProfile profile = new FetchProfile();
        profile.add(FetchProfile.Item.ENVELOPE);
        try {
            folder.fetch(batch.toArray(new Message[0]), profile);
        } catch (MessagingException | RuntimeException e) {
            // a prefetch hiccup (e.g. one unparsable envelope) only costs the prefetch; messages load lazily
            LOG.debug("envelope prefetch failed ({})", e.getClass().getSimpleName());
        }

        Map<Long, Long> gm = ((IMAPStore) store).hasCapability("X-GM-EXT-1")
            ? gmMsgIds(folder, uidOf(folder, batch.get(0)), uidOf(folder, batch.get(batch.size() - 1)))
            : Map.of();
        List<FetchedMail> mails = new ArrayList<>();
        for (Message m : batch) {
            long uid = uidOf(folder, m);
            mails.add(MimeMailExtractor.toMail(folderName, uid, validity, gm.get(uid), (MimeMessage) m, null, clock));
        }
        return new FolderBatch(validity, mails);
    }

    private static long uidOf(IMAPFolder folder, Message m) {
        try {
            return folder.getUID(m);
        } catch (MessagingException e) {
            throw translate(e);
        }
    }

    /** One {@code UID FETCH a:b (UID X-GM-MSGID)}; a failure only costs the Gmail ids. */
    private static Map<Long, Long> gmMsgIds(IMAPFolder folder, long first, long last) {
        try {
            Object result = folder.doCommand(protocol -> {
                Response[] r = protocol.command("UID FETCH " + first + ":" + last + " (UID X-GM-MSGID)", null);
                protocol.notifyResponseHandlers(r);
                protocol.handleResult(r[r.length - 1]);
                return r;
            });
            return parseGmMsgIds((Response[]) result);
        } catch (MessagingException | RuntimeException e) {
            return Map.of();
        }
    }

    static Map<Long, Long> parseGmMsgIds(Response[] responses) {
        Map<Long, Long> map = new HashMap<>();
        for (Response r : responses) {
            if (r == null) {
                continue;
            }
            Matcher uid = UID_ITEM.matcher(r.toString());
            Matcher gm = GM_MSGID.matcher(r.toString());
            if (uid.find() && gm.find()) {
                map.put(Long.parseLong(uid.group(1)), Long.parseLong(gm.group(1)));
            }
        }
        return map;
    }

    private Store connect(String address, String password) throws MessagingException {
        Properties p = new Properties();
        p.put("mail.imaps.connectiontimeout", TIMEOUT_MS);
        p.put("mail.imaps.timeout", TIMEOUT_MS);
        p.put("mail.imaps.writetimeout", TIMEOUT_MS);
        p.put("mail.imaps.ssl.checkserveridentity", "true");
        p.put("mail.imaps.peek", "true"); // BODY.PEEK: never sets \Seen
        p.put("mail.imaps.starttls.enable", "false");
        p.putAll(extraSession);
        Session session = Session.getInstance(p);
        IMAPStore store = (IMAPStore) session.getStore("imaps");
        try {
            store.connect(properties.imapHost(), properties.imapPort(), address, password);
            if (store.hasCapability("ID")) {
                store.id(Map.of("name", "Boop"));
            }
        } catch (MessagingException e) {
            closeQuietly(store);
            throw e;
        }
        return store;
    }

    private static void closeQuietly(Folder f) {
        try {
            if (f.isOpen()) {
                f.close(false);
            }
        } catch (MessagingException e) {
            // read-only folder; nothing to flush
        }
    }

    private static void closeQuietly(Store s) {
        try {
            s.close();
        } catch (MessagingException e) {
            // nothing to do
        }
    }

    /** No cause is attached and the server text is dropped: neither may carry the password. */
    private static SystemRuntimeErrorException translate(MessagingException e) {
        if (e instanceof AuthenticationFailedException) {
            return new SystemRuntimeErrorException(SystemMessage.error(AUTH_FAILED).build(), HttpStatus.BAD_REQUEST);
        }
        return new SystemRuntimeErrorException(SystemMessage.error(UNREACHABLE).build(), HttpStatus.BAD_GATEWAY);
    }
}
