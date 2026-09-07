package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Egy SZABADON kapott név (ma: a Reflexió LLM-jének {@code text_signal.people} eleme) leképezése a
 * kurált Emberek-lista KANONIKUS nevére (bd mezo-xih1). A {@link MentionDetectionService} keresési
 * szabályát fordítja meg: ott a needle a személy neve és a haystack a bejegyzés mondata, itt a
 * haystack maga a kapott név — de ugyanazokkal a {@link PersonNeedles} primitívekkel, mert magyarul
 * a rag a szó végén ül („Lizával", „Rékának").
 *
 * <p>Miért kell: az extraktor promptja alanyesetet kér, de egy modell nem garancia. Írási időben
 * kanonizálva a {@code people:Liza} sorozat pontosan azt jelenti, amit az Emberek oldal „Liza"-ja,
 * és ugyanaz az ember nem esik szét naponta más-más kulcsra.
 *
 * <p>Csak {@code status='active'} személyre képez le — a jelölt/archivált kör nem kap sorozatot,
 * ugyanaz a szabály, mint a mention-detektálásban. Ismeretlen név VÁLTOZATLAN marad: kanonikus
 * alakja nincs, kitalálni nem szabad.
 */
@Service
@RequiredArgsConstructor
public class PersonNameCanonicalizer {

    private final PersonRepository personRepository;

    /**
     * A felhasználó aktív személyeinek needle→kanonikus név térképe, EGY lekérdezésből. A hívó egy
     * jel egész {@code people} tömbjére egyszer kéri el, és minden névre újrahasználja.
     */
    @Transactional(readOnly = true)
    public Map<String, String> canonicalNamesByNeedle(UUID userId) {
        Map<String, String> byNeedle = new LinkedHashMap<>();
        for (PersonEntity person : personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            if (!"active".equals(person.getStatus())) {
                continue;
            }
            for (String needle : PersonNeedles.of(person)) {
                // Ütközésnél az ELSŐ (név szerint rendezett) személy nyer — determinisztikus, és két
                // azonos nevű/aliasú személy amúgy is megkülönböztethetetlen ebből az egy névből.
                byNeedle.putIfAbsent(needle, person.getName());
            }
        }
        return byNeedle;
    }

    /**
     * A kapott név kanonikus alakja, vagy üres, ha egyetlen aktív személyre sem illik. Több
     * találatnál a LEGHOSSZABB needle nyer: a „Nagy Péterrel" a „Nagy Péter", nem a „Nagy".
     */
    public Optional<String> canonicalize(String rawName, Map<String, String> canonicalNamesByNeedle) {
        if (rawName == null || rawName.isBlank() || canonicalNamesByNeedle.isEmpty()) {
            return Optional.empty();
        }
        String folded = TextFold.fold(rawName).strip();
        String best = null;
        int bestLength = 0;
        for (Map.Entry<String, String> entry : canonicalNamesByNeedle.entrySet()) {
            String needle = entry.getKey();
            if (needle.length() > bestLength && PersonNeedles.containsAtWordStart(folded, needle)) {
                best = entry.getValue();
                bestLength = needle.length();
            }
        }
        return Optional.ofNullable(best);
    }
}
