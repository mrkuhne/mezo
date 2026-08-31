package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.text.SafeTruncate;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
    /** 1–2 betűs needle szinte mindenre illik — sosem az, amire a user gondolt. */
    private static final int MIN_NEEDLE_LENGTH = 3;

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
            String excerpt = firstMatchingSentence(sentences, needlesFor(person));
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

    private static List<String> needlesFor(PersonEntity person) {
        List<String> needles = new ArrayList<>();
        addNeedle(needles, person.getName());
        if (person.getAliases() != null) {
            person.getAliases().forEach(a -> addNeedle(needles, a));
        }
        return needles;
    }

    private static void addNeedle(List<String> needles, String raw) {
        String folded = TextFold.fold(raw).strip();
        if (folded.length() >= MIN_NEEDLE_LENGTH) {
            needles.add(folded);
        }
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
                if (containsAtWordStart(folded, needle)) {
                    return sentence;
                }
            }
        }
        return null;
    }

    /** A needle szóhatáron kezdődik; a szó vége szabad (magyar ragok: "adammal", "rekanak"). */
    private static boolean containsAtWordStart(String foldedHaystack, String foldedNeedle) {
        int i = -1;
        while ((i = foldedHaystack.indexOf(foldedNeedle, i + 1)) >= 0) {
            if (i == 0 || !Character.isLetterOrDigit(foldedHaystack.charAt(i - 1))) {
                return true;
            }
        }
        return false;
    }
}
