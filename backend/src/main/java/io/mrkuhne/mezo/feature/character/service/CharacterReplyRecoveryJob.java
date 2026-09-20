package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.CharacterReplyProperties;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;

import lombok.RequiredArgsConstructor;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {
            FeaturesConfiguration.CHARACTER_SWITCH,
            FeaturesConfiguration.COMPANION_SWITCH,
            FeaturesConfiguration.CHARACTER_REPLY_JOB_SWITCH
        },
        havingValue = "true")
public class CharacterReplyRecoveryJob {
    private final UserFanOut users;
    private final CharacterReplyRepository replies;
    private final CharacterReplyProperties properties;
    private final CharacterReplyService service;

    @Scheduled(fixedDelayString = "${mezo.character.reply.recovery-delay-ms}")
    public void run() {
        users.forEachActiveUser(
                "Character reply recovery",
                user ->
                        replies.recoverable(
                                        user.getId(),
                                        Instant.now().minusSeconds(properties.leaseSeconds()),
                                        PageRequest.of(0, properties.historyLimit()))
                                .forEach(r -> service.retry(user.getId(), r.getId())));
    }
}
