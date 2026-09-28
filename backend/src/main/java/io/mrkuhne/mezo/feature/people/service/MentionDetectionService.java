package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.text.SafeTruncate;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Determinisztikus név+alias match a szabad szövegen (spec §3.2, bd mezo-06o0.1). Hajtogatott
 * (ékezet-strip + lowercase, {@link TextFold}) keresés, a needle-nek SZÓHATÁRON kell kezdődnie,
 * de a szó folytatódhat — a magyar ragozás miatt ("Ádámmal", "Rékának") a szóvégi határ-őrzés
 * a valódi említések zömét dobná el. Excerpt = az első találó mondat. tone=NULL (az éjszakai
 * kör tölti, S4). Dedup: {@code existsSourceRefIncludingDeleted} — a ✕-szel visszavont sort egy
 * forrás-újramentés nem támasztja fel; a maradék versenyt a partial unique index zárja
 * ({@link DataIntegrityViolationException} → skip).
 *
 * <p>Csak {@code status='active'} személyre ír (a candidate/archived kör nem szennyezi a feedet).
 * A hívó listenerek felelnek az IDENT-3 nyelésért; ez a service dobhat.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MentionDetectionService {

    /** Feed-barát plafon; a mention.excerpt oszlopnak nincs DB-hossza, ez UX-cap. */
    private static final int EXCERPT_MAX_CHARS = 240;

    private final PersonRepository personRepository;
    private final MentionRepository mentionRepository;

    @Transactional
    public int detect(UUID userId, String text, String source, String sourceRefKind,
            UUID sourceRefId, Instant ts) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        List<PersonEntity> persons = personRepository
                .findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
                .filter(p -> "active".equals(p.getStatus()))
                .toList();
        if (persons.isEmpty()) {
            return 0;
        }
        List<String> sentences = splitSentences(text);
        int written = 0;
        for (PersonEntity person : persons) {
            String excerpt = firstMatchingSentence(sentences, PersonNeedles.of(person));
            if (excerpt == null) {
                continue;
            }
            if (mentionRepository.existsSourceRefIncludingDeleted(
                    userId, person.getId(), sourceRefKind, sourceRefId)) {
                continue;
            }
            MentionEntity m = new MentionEntity();
            m.setCreatedBy(userId);
            m.setPersonId(person.getId());
            m.setTs(ts);
            m.setSource(source);
            m.setExcerpt(SafeTruncate.truncate(excerpt, EXCERPT_MAX_CHARS));
            m.setTone(null); // az éjszakai kör tölti (S4)
            m.setContextLabel(null);
            m.setSourceRefKind(sourceRefKind);
            m.setSourceRefId(sourceRefId);
            m.setFlagged(false);
            try {
                mentionRepository.save(m);
                written++;
            } catch (DataIntegrityViolationException raceLost) {
                // Egyidejű detektálás ugyanarra a (person, kind, ref) kulcsra — a nyertes sora él.
                log.warn("Mention dedup race lost for person {} ref {}/{}",
                        person.getId(), sourceRefKind, sourceRefId);
            }
        }
        return written;
    }

    /**
     * mezo-tdabt ("ezt ne jegyezd meg" really forgets): soft-deletes every live mention written from
     * the given source refs — the chat forget passes the forgotten USER message ids with
     * {@code chat_turn}. The ✕ idiom ({@code @SQLDelete}), so {@link #detect}'s including-deleted
     * dedup never resurrects them; the daily summary and the person page read live rows only.
     * Participates in the caller's transaction: the forget is all-or-nothing.
     */
    @Transactional
    public int forgetBySourceRefs(UUID userId, String sourceRefKind, Collection<UUID> sourceRefIds) {
        if (sourceRefIds == null || sourceRefIds.isEmpty()) {
            return 0;
        }
        List<MentionEntity> rows = mentionRepository
                .findByCreatedByAndSourceRefKindAndSourceRefIdInAndDeletedFalse(userId, sourceRefKind, sourceRefIds);
        mentionRepository.deleteAll(rows);
        mentionRepository.flush();
        return rows.size();
    }

    /**
     * S8 (mezo-d6ivw.12): the SAME name/alias rule as {@link #detect}, read-only — nothing is
     * persisted (the async ChatMentionListener still writes the mention). Active persons only,
     * ordered by where they are first named, capped at {@code max}.
     *
     * <p>Deliberately NOT {@code @Transactional}: the chat turn calls it inside its own transaction,
     * and a participating transactional method that throws marks that transaction rollback-only —
     * the caller's fail-open catch could not undo it (S8 fix round 1). The single repository read
     * runs in the caller's transaction, or its own when there is none.
     */
    public List<MatchedPerson> matchActivePersons(UUID userId, String text, int max) {
        if (text == null || text.isBlank() || max <= 0) {
            return List.of();
        }
        String folded = TextFold.fold(text);
        Map<PersonEntity, Integer> firstIndex = new LinkedHashMap<>();
        for (PersonEntity person : personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            if (!"active".equals(person.getStatus())) {
                continue;
            }
            PersonNeedles.of(person).stream()
                    .mapToInt(needle -> PersonNeedles.indexAtWordStart(folded, needle))
                    .filter(i -> i >= 0)
                    .min()
                    .ifPresent(i -> firstIndex.put(person, i));
        }
        return firstIndex.entrySet().stream()
                .sorted(Map.Entry.comparingByValue())
                .limit(max)
                .map(e -> new MatchedPerson(e.getKey().getId(), e.getKey().getName()))
                .toList();
    }

    /** Mondathatár: záró írásjel vagy sortörés után vágunk; a delimiter a mondatnál marad. */
    private static List<String> splitSentences(String text) {
        return java.util.Arrays.stream(text.split("(?<=[.!?\\n])"))
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private static String firstMatchingSentence(List<String> sentences, List<String> needles) {
        for (String sentence : sentences) {
            String folded = TextFold.fold(sentence);
            for (String needle : needles) {
                if (PersonNeedles.containsAtWordStart(folded, needle)) {
                    return sentence;
                }
            }
        }
        return null;
    }
}
