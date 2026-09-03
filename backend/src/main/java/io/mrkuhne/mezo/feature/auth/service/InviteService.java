package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Invite codes: minted by the owner (S3 admin API), consumed once by registration. */
@Service
@RequiredArgsConstructor
public class InviteService {

    /** Readable alphabet — no 0/O/1/I, so a code survives being read out loud or handwritten. */
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final InviteRepository inviteRepository;

    public static String generateCode() {
        StringBuilder sb = new StringBuilder("MEZO-");
        for (int i = 0; i < 8; i++) {
            if (i == 4) sb.append('-');
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    @Transactional
    public InviteEntity create(UUID createdBy, String label, Instant expiresAt) {
        String code;
        do { code = generateCode(); } while (inviteRepository.existsByCode(code));
        InviteEntity invite = new InviteEntity();
        invite.setCode(code);
        invite.setLabel(label);
        invite.setCreatedBy(createdBy);
        invite.setExpiresAt(expiresAt);
        return inviteRepository.save(invite);
    }

    /**
     * Locks the code row, validates it, and marks it used. Must run inside the caller's
     * transaction (AuthService.register) so the lock spans the user insert.
     */
    @Transactional
    public InviteEntity consume(String rawCode, UUID usedBy) {
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase();
        InviteEntity invite = inviteRepository.findByCodeForUpdate(code)
            .filter(i -> !i.isUsed() && !i.isExpired(Instant.now()))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_INVITE_INVALID").build(), HttpStatus.CONFLICT));
        invite.setUsedBy(usedBy);
        invite.setUsedAt(Instant.now());
        return inviteRepository.save(invite);
    }
}
