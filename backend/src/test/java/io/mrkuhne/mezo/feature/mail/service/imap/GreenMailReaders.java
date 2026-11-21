package io.mrkuhne.mezo.feature.mail.service.imap;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import java.time.Clock;
import java.util.Properties;

/** Test-only door to the package-private {@link ImapMailReader} constructor, trusting GreenMail's self-signed cert. */
public final class GreenMailReaders {

    private GreenMailReaders() {}

    public static MailReader trusting(MailProperties props) {
        Properties extra = new Properties();
        extra.put("mail.imaps.ssl.trust", "*");
        extra.put("mail.imaps.ssl.checkserveridentity", "false");
        return new ImapMailReader(props, extra, Clock.systemUTC());
    }
}
