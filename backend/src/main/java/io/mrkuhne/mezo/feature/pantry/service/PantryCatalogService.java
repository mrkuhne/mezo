package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The shared-catalog rules (S4, mezo-qw37.4): natural-key find-or-create, the idempotent
 * "put it on my shelf" ({@link #ensureItem}), the author-or-OWNER edit gate, and the
 * "shared from" author names. Every writer that turns a definition into a shelf row —
 * {@link PantryService}, {@code PantryImportService}, {@code ProtocolSeedData}, the AI meal draft,
 * the Receptműhely — goes through here so the one-live-row-per-(user, definition) invariant has a
 * single owner.
 *
 * <p><b>Never</b> call {@code catalogRepository.delete*}: {@code pantry_catalog} carries no
 * {@code @SQLDelete}, so a delete is a HARD delete that either trips
 * {@code fk_pantry_item_catalog_id_pantry_catalog_id ON DELETE RESTRICT} or destroys a definition
 * that other users still have on their shelves. Retire a definition with {@code setDeleted(true)}.
 */
@Service
@RequiredArgsConstructor
public class PantryCatalogService {

    static final int SEARCH_LIMIT = 50;

    private final PantryCatalogRepository catalogRepository;
    private final PantryItemRepository itemRepository;
    private final AppUserRepository appUserRepository;
    private final PantryMapper mapper;
    private final PlatformTransactionManager transactionManager;

    /** Global search: master + every user's live definitions, name OR brand, case-insensitive, max 50. */
    @Transactional(readOnly = true)
    public List<PantryCatalogEntry> search(String q, String kind) {
        String needle = q == null ? "" : q.strip().toLowerCase(Locale.ROOT)
            .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        String like = "%" + needle + "%";
        List<PantryCatalogEntity> hits = kind == null || kind.isBlank()
            ? catalogRepository.searchAll(like, Limit.of(SEARCH_LIMIT))
            : catalogRepository.searchByKind(like, kind, Limit.of(SEARCH_LIMIT));
        Map<UUID, String> names = authorNames(hits);
        return hits.stream()
            .map(c -> mapper.toCatalogEntry(c, c.isMaster() ? null : names.get(c.getCreatedBy())))
            .toList();
    }

    /**
     * Natural-key find-or-create. A hit (even a soft-deleted one left by the migration) is revived
     * and returned — never a 409 (spec §11). A miss is inserted in its OWN committed transaction so
     * that two users typing the same food at once both end up bound to the single winner: the
     * loser's unique-index violation is caught and re-resolved by lookup.
     */
    public PantryCatalogEntity findOrCreate(UUID authorId, PantryCatalogEntity candidate) {
        Objects.requireNonNull(candidate.getName(), "candidate.name");
        candidate.setName(candidate.getName().strip());
        if (candidate.getBrand() != null) {
            candidate.setBrand(candidate.getBrand().strip());
        }
        return catalogRepository.findByNaturalKey(candidate.getName(), candidate.getBrand())
            .map(this::revive)
            .orElseGet(() -> insertOrBind(authorId, candidate));
    }

    /**
     * A definition the migration (or a retiring user) marked deleted comes back to life the moment
     * somebody binds to it again — a live {@code pantry_item} must never point at a dead row.
     * Soft-undelete only; never a hard delete/insert pair (the FK is ON DELETE RESTRICT).
     */
    private PantryCatalogEntity revive(PantryCatalogEntity c) {
        if (c.isDeleted()) {
            c.setDeleted(false);
            return catalogRepository.saveAndFlush(c);
        }
        return c;
    }

    private PantryCatalogEntity insertOrBind(UUID authorId, PantryCatalogEntity candidate) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        try {
            UUID id = own.execute(status -> {
                // createdBy MUST be set: a null createdBy means "loader master content", so a
                // user-typed definition without it would silently join the seeded master catalog.
                candidate.setCreatedBy(authorId);
                if (candidate.getSource() == null) {
                    candidate.setSource("manual");
                }
                return catalogRepository.saveAndFlush(candidate).getId();
            });
            return catalogRepository.findById(id).orElseThrow(); // re-read in the caller's session
        } catch (DataIntegrityViolationException raced) {
            return catalogRepository.findByNaturalKey(candidate.getName(), candidate.getBrand())
                .map(this::revive)
                .orElseThrow(() -> raced);
        }
    }

    /** Idempotent "from-catalog": the caller's live row for the definition, created if missing. */
    @Transactional
    public PantryItemEntity ensureItem(UUID userId, UUID catalogId) {
        return itemRepository.findByCreatedByAndCatalog_IdAndDeletedFalse(userId, catalogId)
            .orElseGet(() -> {
                PantryCatalogEntity catalog = catalogRepository.findById(catalogId)
                    .filter(c -> !c.isDeleted())
                    .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
                PantryItemEntity item = new PantryItemEntity();
                item.setCreatedBy(userId); // server-side ownership — never from the client
                item.setCatalog(catalog);
                return itemRepository.saveAndFlush(item);
            });
    }

    /** OWNER edits anything; a USER edits only the definitions they authored (master rows are OWNER-only). */
    public boolean editable(AppUserEntity user, PantryCatalogEntity c) {
        return user.isOwner() || (!c.isMaster() && c.getCreatedBy().equals(user.getId()));
    }

    /** 403 gate — call BEFORE mutating any definition field, or Hibernate flushes the refused edit. */
    public void requireEditable(AppUserEntity user, PantryCatalogEntity c) {
        if (!editable(user, c)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_CATALOG_NOT_EDITABLE").build(), HttpStatus.FORBIDDEN);
        }
    }

    /** One batch read of the authoring users' names (master rows have none). */
    public Map<UUID, String> authorNames(Collection<PantryCatalogEntity> rows) {
        List<UUID> ids = rows.stream()
            .map(PantryCatalogEntity::getCreatedBy).filter(Objects::nonNull).distinct().toList();
        return ids.isEmpty() ? Map.of() : appUserRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(AppUserEntity::getId, AppUserEntity::getName));
    }

    /** null when the row is master or the user's own; else the author's display name. */
    public String sharedFromName(UUID userId, PantryCatalogEntity c, Map<UUID, String> names) {
        if (c.isMaster() || c.getCreatedBy().equals(userId)) {
            return null;
        }
        return names.getOrDefault(c.getCreatedBy(), "ismeretlen");
    }
}
