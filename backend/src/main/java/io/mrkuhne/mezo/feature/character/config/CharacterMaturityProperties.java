package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Csapatfal érettség-görbe (mezo-a9bo7.11): the nightly snapshot cron and the zone that defines
 *  "today" and the ISO week for both the job and the history read. */
@Validated
@ConfigurationProperties(prefix = "mezo.character.maturity")
public record CharacterMaturityProperties(@NotBlank String cron, @NotBlank String zone) {}
