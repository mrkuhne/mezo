package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.concurrent.RejectedExecutionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The twice-daily morning post (mezo-r36n9.39): 08:00 and 15:00 Europe/Budapest ({@code mezo.mail.cron} /
 * {@code .zone}). Exists only with both switches on — the feature ({@link FeaturesConfiguration#MAIL_SWITCH}) and the
 * cron bean ({@link FeaturesConfiguration#MAIL_JOB_SWITCH}); the body only hands off to
 * {@link MailRunner#runAsync} so the scheduler thread is never held by mail-server calls.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.MAIL_SWITCH, FeaturesConfiguration.MAIL_JOB_SWITCH},
    havingValue = "true")
public class MailJob {

    private final MailRunner runner;

    @Scheduled(cron = "${mezo.mail.cron:0 0 8,15 * * *}", zone = "${mezo.mail.zone:Europe/Budapest}")
    public void run() {
        try {
            runner.runAsync();
        } catch (RejectedExecutionException e) {
            log.warn("Mail run skipped: the mail executor is full");
        }
    }
}
