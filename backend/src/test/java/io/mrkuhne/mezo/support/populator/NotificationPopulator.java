package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.notification.entity.NotificationPrefEntity;
import io.mrkuhne.mezo.feature.notification.entity.NotificationScheduleEntity;
import io.mrkuhne.mezo.feature.notification.entity.PushLogEntity;
import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.feature.notification.repository.NotificationPrefRepository;
import io.mrkuhne.mezo.feature.notification.repository.NotificationScheduleRepository;
import io.mrkuhne.mezo.feature.notification.repository.PushLogRepository;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class NotificationPopulator {

    /**
     * A <b>genuinely valid</b> subscription {@code p256dh}: the RFC 8291 §5 "User agent public key"
     * — 65 base64url-decoded bytes on the P-256 curve. It has to be real key material, not merely
     * valid-looking: {@code Aes128GcmEncryptor} rejects a wrong-width or off-curve point with
     * {@code WEBPUSH_KEY_INVALID}, which {@code WebPushClient} now classifies as {@code GONE}, so a
     * fake key would make every fixture device prune itself and quietly turn "the push failed"
     * tests into "the device was deleted" tests.
     */
    public static final String VALID_P256DH =
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";

    /** The matching RFC 8291 §5 "Authentication Secret" — exactly 16 base64url-decoded bytes. */
    public static final String VALID_AUTH = "BTBZMqHH6r4Tts7J_aSIgg";

    /** Deliberately the wrong width (not 65 bytes) — a row that can never deliver. */
    public static final String MALFORMED_P256DH = "BOr1a2b3";

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final NotificationPrefRepository notificationPrefRepository;
    private final PushLogRepository pushLogRepository;
    private final NotificationScheduleRepository notificationScheduleRepository;

    /** A live subscription whose key material is real enough to reach the encrypt+sign path. */
    public PushSubscriptionEntity subscription(UUID owner, String endpoint) {
        return subscription(owner, endpoint, VALID_P256DH);
    }

    /** Same, with caller-chosen {@code p256dh} — for the malformed-key pruning path. */
    public PushSubscriptionEntity subscription(UUID owner, String endpoint, String p256dh) {
        PushSubscriptionEntity e = new PushSubscriptionEntity();
        e.setCreatedBy(owner);
        e.setEndpoint(endpoint);
        e.setP256dh(p256dh);
        e.setAuth(VALID_AUTH);
        e.setUserAgent("iPhone");
        return pushSubscriptionRepository.saveAndFlush(e);
    }

    /** A per-category notification preference row. */
    public NotificationPrefEntity pref(UUID owner, String category, boolean enabled, int leadMinutes) {
        NotificationPrefEntity e = new NotificationPrefEntity();
        e.setCreatedBy(owner);
        e.setCategory(category);
        e.setEnabled(enabled);
        e.setLeadMinutes(leadMinutes);
        return notificationPrefRepository.saveAndFlush(e);
    }

    /** A dedup-ledger row: one send record for (owner, date, dedupKey). */
    public PushLogEntity pushLog(UUID owner, LocalDate date, String dedupKey, String category) {
        PushLogEntity e = new PushLogEntity();
        e.setCreatedBy(owner);
        e.setLogDate(date);
        e.setDedupKey(dedupKey);
        e.setCategory(category);
        return pushLogRepository.saveAndFlush(e);
    }

    /** A FE-written recurring schedule row. {@code weekday} null means every day. */
    public NotificationScheduleEntity schedule(UUID owner, Integer weekday, String time, String category,
            String title, String body, String deeplink, String source) {
        NotificationScheduleEntity e = new NotificationScheduleEntity();
        e.setCreatedBy(owner);
        e.setWeekday(weekday);
        e.setTime(time);
        e.setCategory(category);
        e.setTitle(title);
        e.setBody(body);
        e.setDeeplink(deeplink);
        e.setSource(source);
        return notificationScheduleRepository.saveAndFlush(e);
    }
}
