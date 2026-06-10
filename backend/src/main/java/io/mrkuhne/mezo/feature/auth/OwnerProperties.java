package io.mrkuhne.mezo.feature.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "mezo.auth")
public record OwnerProperties(String ownerEmail, String ownerPassword, String ownerName, String jwtSecret) {
    public String email() { return ownerEmail; }
    public String password() { return ownerPassword; }
    public String name() { return ownerName; }
}
