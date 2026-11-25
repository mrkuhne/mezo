package io.mrkuhne.mezo.feature.mail.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/** The per-day mail LLM cap (USD 0.15 / Budapest day) against real llm_log rows; fixtures anchored to the queried day. */
@TestPropertySource(properties = "mezo.mail.enabled=true")
class MailCostCapIT extends AbstractIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");

    @Autowired private MailCostCap cap;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LlmLogPopulator llmLogPopulator;

    private void spend(Instant at, UUID owner, String slug, String usd) {
        llmLogPopulator.logAt(at, owner, CallKind.CHAT, slug, "gemini-2.5-flash", 10, 5, null, new BigDecimal(usd));
    }

    @Test
    void capAllowsUntilThreshold() {
        UUID owner = userPopulator.createUser("mail-cap@test.hu").getId();
        ZonedDateTime now = ZonedDateTime.now(BUDAPEST);
        Instant dayStart = now.toLocalDate().atStartOfDay(BUDAPEST).toInstant();
        // a minute after local midnight: inside the queried day whatever time the test runs
        Instant inDay = dayStart.plusSeconds(60);

        assertThat(cap.allows(owner, now)).isTrue();

        spend(inDay, owner, LlmCallContext.FEATURE_MAIL_CLASSIFY, "0.060000");
        spend(inDay, owner, LlmCallContext.FEATURE_MAIL_SCORE, "0.050000");
        assertThat(cap.allows(owner, now)).isTrue();

        spend(inDay, owner, LlmCallContext.FEATURE_MAIL_SCREEN, "0.040000");
        assertThat(cap.allows(owner, now)).isFalse();
    }

    @Test
    void capIgnoresYesterdayOtherFeaturesAndOtherOwners() {
        UUID owner = userPopulator.createUser("mail-cap2@test.hu").getId();
        UUID other = userPopulator.createUser("mail-cap3@test.hu").getId();
        ZonedDateTime now = ZonedDateTime.now(BUDAPEST);
        Instant dayStart = now.toLocalDate().atStartOfDay(BUDAPEST).toInstant();

        spend(dayStart.minusSeconds(60), owner, LlmCallContext.FEATURE_MAIL_CLASSIFY, "9.000000");
        spend(dayStart.plusSeconds(60), owner, "companion_chat", "9.000000");
        spend(dayStart.plusSeconds(60), other, LlmCallContext.FEATURE_MAIL_CLASSIFY, "9.000000");

        assertThat(cap.allows(owner, now)).isTrue();
    }
}
