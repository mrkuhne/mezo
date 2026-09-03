package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.api.dto.AdminUserResponse;
import io.mrkuhne.mezo.api.dto.CreateInviteRequest;
import io.mrkuhne.mezo.api.dto.InviteResponse;
import io.mrkuhne.mezo.api.dto.ResetPasswordResponse;
import io.mrkuhne.mezo.api.dto.SetUserStatusRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Beta admin (mezo-qw37.3): invite codes and account management for the OWNER. Authorization is
 * the controller's job ({@code CurrentUser.requireOwner()} on every entry point) — this service
 * assumes an owner is calling and only enforces the domain rules (used codes are immutable
 * history, the owner cannot lock themselves out).
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    /** Same readable alphabet as invite codes plus lowercase — a temp password is read out loud too. */
    static final String PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    static final int PASSWORD_LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final InviteService inviteService;
    private final InviteRepository inviteRepository;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    // ── invites ──────────────────────────────────────────────────────────────────

    @Transactional
    public InviteResponse createInvite(AppUserEntity owner, CreateInviteRequest request) {
        Instant expiresAt = request.getExpiresInDays() == null
            ? null
            : Instant.now().plus(request.getExpiresInDays(), ChronoUnit.DAYS);
        InviteEntity invite = inviteService.create(owner.getId(), blankToNull(request.getLabel()), expiresAt);
        return toResponse(invite, Map.of());
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> listInvites() {
        List<InviteEntity> invites = inviteRepository.findAllByOrderByCreatedAtDesc();
        List<UUID> consumerIds = invites.stream().map(InviteEntity::getUsedBy).filter(Objects::nonNull).toList();
        Map<UUID, String> names = appUserRepository.findAllById(consumerIds).stream()
            .collect(Collectors.toMap(AppUserEntity::getId, AppUserEntity::getName));
        return invites.stream().map(i -> toResponse(i, names)).toList();
    }

    @Transactional
    public void deleteInvite(UUID id) {
        InviteEntity invite = inviteRepository.findById(id)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_INVITE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (invite.isUsed()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_INVITE_USED").build(), HttpStatus.CONFLICT);
        }
        inviteRepository.delete(invite);
    }

    // ── users ────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers() {
        return appUserRepository.findAll().stream()
            .sorted(Comparator.comparing(AppUserEntity::getCreatedAt))
            .map(AdminService::toResponse)
            .toList();
    }

    /** The temp password exists in clear only in this response — the row stores the BCrypt hash. */
    @Transactional
    public ResetPasswordResponse resetPassword(UUID id) {
        AppUserEntity user = requireUser(id);
        String temporary = generateTemporaryPassword();
        user.setPasswordHash(passwordEncoder.encode(temporary));
        user.setMustChangePassword(true);
        // Finding 1 (mezo-qw37.3 review): a reset must revoke the target's existing sessions the
        // same way AuthService.changePassword does — otherwise a stolen token outlives the reset
        // that was supposed to kill it. Truncated to seconds because JWT iat has second
        // granularity: an untruncated Instant.now() would round down and make the next login's
        // token (iat == this second) compare isBefore the watermark and be revoked on arrival.
        user.setTokensValidFrom(Instant.now().truncatedTo(ChronoUnit.SECONDS));
        appUserRepository.save(user);
        return ResetPasswordResponse.builder().temporaryPassword(temporary).build();
    }

    @Transactional
    public void setStatus(AppUserEntity actor, UUID id, SetUserStatusRequest request) {
        if (actor.getId().equals(id)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_SELF_STATUS").build(), HttpStatus.CONFLICT);
        }
        AppUserEntity user = requireUser(id);
        user.setStatus(AppUserEntity.UserStatus.valueOf(request.getStatus())); // contract pattern guarantees the value
        appUserRepository.save(user);
    }

    static String generateTemporaryPassword() {
        StringBuilder sb = new StringBuilder(PASSWORD_LENGTH);
        for (int i = 0; i < PASSWORD_LENGTH; i++) {
            sb.append(PASSWORD_ALPHABET.charAt(RANDOM.nextInt(PASSWORD_ALPHABET.length())));
        }
        return sb.toString();
    }

    private AppUserEntity requireUser(UUID id) {
        return appUserRepository.findById(id)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_USER_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private static InviteResponse toResponse(InviteEntity i, Map<UUID, String> names) {
        return InviteResponse.builder()
            .id(i.getId())
            .code(i.getCode())
            .label(i.getLabel())
            .createdAt(at(i.getCreatedAt()))
            .expiresAt(at(i.getExpiresAt()))
            .usedBy(i.getUsedBy())
            .usedByName(i.getUsedBy() == null ? null : names.get(i.getUsedBy()))
            .usedAt(at(i.getUsedAt()))
            .build();
    }

    private static AdminUserResponse toResponse(AppUserEntity u) {
        return AdminUserResponse.builder()
            .id(u.getId())
            .email(u.getEmail())
            .name(u.getName())
            .role(u.getRole().name())
            .status(u.getStatus().name())
            .createdAt(at(u.getCreatedAt()))
            .onboardedAt(at(u.getOnboardedAt()))
            .lastSeenAt(at(u.getLastSeenAt()))
            .build();
    }

    private static OffsetDateTime at(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
