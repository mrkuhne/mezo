package io.mrkuhne.mezo.feature.character.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/**
 * Final review C1 + I3 (mezo-a9bo7.25): {@link TeamChatService#decidePush}'s gates, without a
 * database — a {@code feed}-channel library entry never pushes; an open in the EVENING part of the
 * quiet window (22:00–24:00) stays silent unless the entry is {@code quietHoursExempt}, and an
 * exempt push carries the marker the feed-anchored push path reads back; an after-midnight open
 * inside the window still pushes (the anchor defers its ring). The budget race itself is pinned
 * against Postgres in {@code TeamChatServiceIT}.
 */
class TeamChatPushDecisionTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    private final TeamChatThreadRepository threads = mock(TeamChatThreadRepository.class);
    private final AppNotificationEmitter emitter = mock(AppNotificationEmitter.class);
    private TeamChatService service;

    @BeforeEach
    void setUp() {
        TeamChatProperties properties = new TeamChatProperties(ZONE, 7, 12, 2, new BigDecimal("1.00"),
                "0 10 4 * * *", "0 20 * * * *", "0 0 7 * * *", 4, 20, 30, 4, 0);
        NotificationProperties notification = new NotificationProperties(160, "09:00", "20:00", 240,
                "0 * * * * *", 5, 5, new NotificationProperties.QuietHours("22:00", "07:00"));
        // decidePush reaches reservePush through the self proxy (its own REQUIRES_NEW transaction);
        // without Spring the "proxy" is the service itself.
        @SuppressWarnings("unchecked")
        ObjectProvider<TeamChatService> self = mock(ObjectProvider.class);
        service = new TeamChatService(threads, null, properties, null, null, null, null, emitter, null, null,
                null, notification, new TeamChatQuietHours(notification, properties), self, null, null);
        when(self.getObject()).thenReturn(service);
        when(threads.findByCreatedByAndPushedTrueAndOpenedAtBetweenAndDeletedFalse(any(), any(), any()))
                .thenReturn(List.of());
        when(emitter.tryEmit(any(), any(), any(), any(), any(), any(), any())).thenReturn(true);
    }

    private TeamChatThreadEntity thread(int hour, int minute) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setId(UUID.randomUUID());
        t.setCreatedBy(UUID.randomUUID());
        t.setFlagKey(FlagKey.SLEEP_DEBT);
        t.setOwnerCharacter("szunya");
        t.setStatus("OPEN");
        t.setOpenedAt(LocalDate.of(2026, 9, 26).atTime(hour, minute).atZone(ZONE).toInstant());
        when(threads.findById(t.getId())).thenReturn(Optional.of(t));
        // the fresh, post-lock read (mezo-a9bo7.27) follows the entity's own state
        when(threads.unpushedStatus(t.getId())).thenAnswer(inv ->
                Boolean.TRUE.equals(t.getPushed()) ? Optional.empty() : Optional.of(t.getStatus()));
        when(threads.setPushed(eq(t.getId()), anyBoolean())).thenAnswer(inv -> {
            t.setPushed(inv.getArgument(1));
            return 1;
        });
        return t;
    }

    @Test
    void feedChannelEntry_neverPushes() {
        TeamChatThreadEntity t = thread(10, 0);

        service.decidePush(t.getId(), "sor", false, false);

        assertThat(t.getPushed()).isFalse();
        verify(emitter, never()).tryEmit(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void daytimeOpen_pushesWithThePlainDedupKey() {
        TeamChatThreadEntity t = thread(10, 0);

        service.decidePush(t.getId(), "sor", true, false);

        assertThat(t.getPushed()).isTrue();
        verify(threads).lockPushBudget(t.getCreatedBy());
        verify(emitter).tryEmit(eq(t.getCreatedBy()), eq(AppNotificationKind.TEAM_CHAT), anyString(), eq("sor"),
                eq("/mezo/elo"), eq(t.getId()), eq("team_chat:" + t.getId()));
    }

    @Test
    void eveningQuietOpen_staysSilent_andNeverTakesTheBudgetLock() {
        TeamChatThreadEntity t = thread(22, 30);

        service.decidePush(t.getId(), "sor", true, false);

        assertThat(t.getPushed()).isFalse();
        verify(threads, never()).lockPushBudget(any());
        verify(emitter, never()).tryEmit(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void eveningQuietOpen_ofAnExemptEntry_pushesWithTheExemptMarker() {
        TeamChatThreadEntity t = thread(22, 30);

        service.decidePush(t.getId(), "sor", true, true);

        assertThat(t.getPushed()).isTrue();
        verify(emitter).tryEmit(eq(t.getCreatedBy()), eq(AppNotificationKind.TEAM_CHAT), anyString(), eq("sor"),
                eq("/mezo/elo"), eq(t.getId()), eq("team_chat:" + t.getId() + AppNotificationKind.QUIET_HOURS_EXEMPT_SUFFIX));
        assertThat(AppNotificationKind.quietHoursExempt("team_chat:" + t.getId()
                + AppNotificationKind.QUIET_HOURS_EXEMPT_SUFFIX)).isTrue();
    }

    @Test
    void afterMidnightOpenInsideTheWindow_stillPushes() {
        TeamChatThreadEntity t = thread(3, 0);

        service.decidePush(t.getId(), "sor", true, false);

        assertThat(t.getPushed()).isTrue();
        verify(emitter).tryEmit(any(), any(), any(), any(), any(), any(), eq("team_chat:" + t.getId()));
    }

    @Test
    void aFailedEmit_givesTheBudgetSlotBack() {
        TeamChatThreadEntity t = thread(10, 0);
        when(emitter.tryEmit(any(), any(), any(), any(), any(), any(), any())).thenReturn(false);

        service.decidePush(t.getId(), "sor", true, false);

        verify(threads).setPushed(t.getId(), true);
        verify(threads).setPushed(t.getId(), false);
        assertThat(t.getPushed()).isFalse();
    }

    @Test
    void anUgyAlreadyPushedByARacingDecision_isNotPushedAgain() {
        TeamChatThreadEntity t = thread(10, 0);
        // the copy loaded before the lock still says "not pushed"; the database already says pushed
        when(threads.unpushedStatus(t.getId())).thenReturn(Optional.empty());

        service.decidePush(t.getId(), "sor", true, false);

        verify(threads, never()).setPushed(any(), anyBoolean());
        verify(emitter, never()).tryEmit(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void anUgyResolvedWhileTheLineWasVoiced_isNotPushed() {
        TeamChatThreadEntity t = thread(10, 0);
        when(threads.unpushedStatus(t.getId())).thenReturn(Optional.of("RESOLVED"));

        service.decidePush(t.getId(), "sor", true, false);

        verify(emitter, never()).tryEmit(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void inEveningQuiet_isWrapAware() {
        assertThat(service.inEveningQuiet(at(21, 59))).isFalse();
        assertThat(service.inEveningQuiet(at(22, 0))).isTrue();
        assertThat(service.inEveningQuiet(at(23, 59))).isTrue();
        assertThat(service.inEveningQuiet(at(0, 0))).isFalse();
        assertThat(service.inEveningQuiet(at(6, 59))).isFalse();
    }

    private static Instant at(int hour, int minute) {
        return LocalDate.of(2026, 9, 26).atTime(hour, minute).atZone(ZONE).toInstant();
    }
}
