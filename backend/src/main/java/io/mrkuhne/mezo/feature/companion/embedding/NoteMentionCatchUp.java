package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * S2 jegyzet-leg (spec §3.2 "jegyzet-catchup"): a jegyzeteknek nincs mentés-eseményük — a
 * {@code NoteEmbeddingCatchUp} nightly mintájára a {@code NarrativeNoteSource} port teljes élő
 * állományán fut a név-match, és a dedup ({@code existsSourceRefIncludingDeleted} + partial
 * unique index) teszi idempotenssé az ismételt éjszakai futást. minChars=1: a mention-matchnek
 * a rövid jegyzet is számít (az embedding-küszöb az embedding gazdaságossága, nem a miénk).
 * ts = a jegyzet {@code occurredOn} napkezdete (UTC) — egy régi jegyzet első sweepje ne
 * árassza el "mai" említésekkel a feedet. A bean a companionban él (companion→people él már
 * létezik; people→companion ciklust zárna), kapuzás PEOPLE ∧ COMPANION.
 *
 * <p>{@code notesToEmbed} szemantikájának ellenőrzése (mezo-06o0.1, Task 4): mind
 * {@code ActivityLogRepository.findNoteCandidates}, mind {@code CheckInRepository.findNoteCandidates}
 * kizárólag {@code createdBy}/{@code through}/{@code minChars(length)}-re szűr — NINCS
 * embedding-státusz predikátum a lekérdezésben; a "still-unembedded" jelleg ({@code
 * NoteEmbeddingCatchUp}-ban) a HÍVÓ oldalon, a {@code storedByRef} tartalom-összevetéssel valósul
 * meg, nem a porton belül. Ez a sweep tehát MINDEN élő, hossz-kapun átjutó jegyzeten fut, azon is,
 * amelyiknek már van vektora — ez pontosan a kívánt viselkedés (a mention-dedup a
 * {@code MentionDetectionService}-ben van, nem itt).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.PEOPLE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class NoteMentionCatchUp {

    private final ObjectProvider<NarrativeNoteSource> noteSources;
    private final MentionDetectionService mentionDetectionService;

    /** Végigmegy minden forrás élő jegyzetein {@code through}-ig; visszaadja az új mentionök számát. */
    public int run(UUID userId, LocalDate through) {
        int written = 0;
        for (NarrativeNoteSource source : noteSources.orderedStream().toList()) {
            String kind = source.kind();
            for (NarrativeNoteSource.Note note : source.notesToEmbed(userId, through, 1)) {
                try {
                    written += mentionDetectionService.detect(userId, note.text(), "text", kind,
                            note.id(), note.occurredOn().atStartOfDay(ZoneOffset.UTC).toInstant());
                } catch (Exception e) {
                    log.warn("Note mention detection failed for {} {}", kind, note.id(), e);
                }
            }
        }
        return written;
    }
}
