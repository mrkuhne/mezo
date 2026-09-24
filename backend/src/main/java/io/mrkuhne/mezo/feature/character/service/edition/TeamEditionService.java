package io.mrkuhne.mezo.feature.character.service.edition;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionGuestsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionRefsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionPostEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionPostRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterRunLog;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Az esti kiadás futtatója és publikálója (Task 5, spec 2026-09-24 §3): egy nap kiadása
 * idempotens — {@link #run} első dolga megnézni, van-e már élő kiadás az adott napra, és ha igen,
 * azonnal visszatér. Ez teszi biztonságossá, hogy a {@code CharacterCouncilJob} minden 15 perces
 * tiken meghívja: egy sikertelen/hiányzó kiadás a következő tiken újra megpróbálódik 23:45-ig (a job
 * saját ready-at/catch-up ablaka), egy már kész kiadás pedig egy gyors, írásmentes SELECT.
 *
 * <p>A rangsorolást a tiszta {@link EditionSelector} végzi a {@link EditionCandidateCollector}
 * által összegyűjtött jelöltekön, az előző 7 nap megjelenéseinek (ismétlés-tilalom) és az utolsó
 * kiadás időpontjának (frissesség) ismeretében. A tényleges mentés a {@link #publish} metódusban
 * történik, KÜLÖN tranzakcióban a self-injection idiómán át (lásd {@code CharacterCouncilService}
 * — ugyanez a minta), hogy a {@code @Transactional} valóban proxy-n át hívódjon.
 *
 * <p>A poszt szövegét H3 (mezo-a9bo7.14) óta az {@link EditionVoiceWriter} adja: a karakterek saját
 * hangja egyetlen LLM-hívásból, tény-őrrel. Az író SOHA nem dob és mindig pontosan annyi szöveget
 * ad vissza, ahány jelölt van — a hang hiánya ({@code voiced=false}, a nyers rekordszöveg) sosem
 * akadályozza meg a kiadás megjelenését (ADR 0049).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.TEAM_EDITION_SWITCH}, havingValue = "true")
public class TeamEditionService {

    private final TeamEditionRepository editions;
    private final TeamEditionPostRepository posts;
    private final TeamEditionReads reads;
    private final EditionCandidateCollector collector;
    private final CharacterRunLog runLog;
    private final AppNotificationEmitter appNotifications;
    private final EditionVoiceWriter voiceWriter;
    private final ObjectProvider<TeamEditionService> self;

    public void run(UUID owner, LocalDate day) {
        if (editions.findByCreatedByAndDay(owner, day).isPresent()) {
            return; // idempotens: már van élő kiadás erre a napra
        }
        var last = editions.findFirstByCreatedByAndDayLessThanOrderByDayDesc(owner, day);
        Instant lastAt = last.map(TeamEditionEntity::getGeneratedAt).orElse(null);
        var prior = priorShowings(owner, day);
        var ranked = EditionSelector.select(collector.collect(owner, day, lastAt), prior, lastAt);
        var conferenceId = reads.dailyConference(owner, day).map(CharacterConferenceEntity::getId).orElse(null);
        var texts = voiceWriter.write(owner, ranked);
        TeamEditionEntity published;
        try {
            published = self.getObject().publish(owner, day, conferenceId, ranked, texts);
        } catch (DataIntegrityViolationException raced) {
            // Csak akkor "a párhuzamos futás nyert" (uq_team_edition_day), ha VALÓBAN van már élő
            // kiadás erre a napra — egy MÁS okból dobott DataIntegrityViolationException (pl. egy
            // rossz jelölt-adat) nem nyelhető el csendben: visszadobjuk, a hívó (CharacterCouncilJob)
            // saját try/catch-e naplózza, és a következő tiken újrapróbálkozik.
            if (editions.findByCreatedByAndDay(owner, day).isPresent()) {
                return;
            }
            throw raced;
        }
        runLog.record(owner, "EDITION", day, ranked.size(), 0, List.of(),
                ranked.stream().map(c -> c.character().key()).distinct().toList(), conferenceId);
        // H2 (mezo-a9bo7.13): a fal megtelt — szólunk. Csendes napon (0 poszt) NEM értesítünk:
        // egy néma estéért nem rezeg a telefon. A dedup kulcs a nap, így az idempotens újrafutás
        // és a 15 perces tikek sem szülnek másodikat.
        if (!ranked.isEmpty()) {
            appNotifications.emit(owner, AppNotificationKind.TEAM_EDITION, "Megjött az esti kiadás",
                    ranked.size() + " bejegyzés a csapattól", AppNotificationKind.TEAM_EDITION.deeplink(),
                    published.getId(), "team_edition:" + day);
        }
    }

    /** Az adott nap kiadásának mentése — saját tranzakcióban, self-injection-nel hívva (lásd
     *  osztály-javadoc), hogy a {@code uq_team_edition_day} ütközés a HÍVÓ (nem ennek a metódusnak
     *  a) tranzakcióját poszolja el, {@link #run}-ban elkaphatóan. */
    @Transactional
    public TeamEditionEntity publish(UUID owner, LocalDate day, UUID conferenceId,
            List<EditionCandidate> ranked, List<VoicedText> voiced) {
        if (voiced.size() != ranked.size()) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TEAM_EDITION_VOICED_SIZE_MISMATCH").build());
        }
        TeamEditionEntity edition = new TeamEditionEntity();
        edition.setCreatedBy(owner);
        edition.setDay(day);
        edition.setStatus(ranked.isEmpty() ? "QUIET" : "PUBLISHED");
        edition.setGeneratedAt(Instant.now());
        edition.setConferenceId(conferenceId);
        edition = editions.saveAndFlush(edition);

        for (int i = 0; i < ranked.size(); i++) {
            EditionCandidate candidate = ranked.get(i);
            VoicedText text = voiced.get(i);
            TeamEditionPostEntity post = new TeamEditionPostEntity();
            post.setCreatedBy(owner);
            post.setEditionId(edition.getId());
            post.setRank((short) (i + 1));
            post.setCharacterKey(candidate.character().key());
            post.setGenre(candidate.genre().key());
            post.setSourceKind(candidate.sourceKind());
            post.setSourceId(candidate.sourceId());
            post.setSourceRoute(candidate.sourceRoute());
            post.setTitle(text.title());
            post.setBody(text.body());
            post.setVoiced(text.voiced());
            post.setFacts(new EditionFactsEnvelope(candidate.facts()));
            post.setRefs(new EditionRefsEnvelope(candidate.refs()));
            post.setGuests(new EditionGuestsEnvelope(List.of()));
            posts.saveAndFlush(post);
        }
        return edition;
    }

    /** Az előző 7 nap (day-7 .. day-1) kiadásainak posztjai, sourceKey + kiadás-generatedAt párban
     *  — ez az {@link EditionSelector} ismétlés-tilalmának bemenete. */
    private List<PriorShowing> priorShowings(UUID owner, LocalDate day) {
        List<TeamEditionEntity> priorEditions =
                editions.findByCreatedByAndDayBetweenOrderByDayDesc(owner, day.minusDays(7), day.minusDays(1));
        if (priorEditions.isEmpty()) {
            return List.of();
        }
        var editionsById = priorEditions.stream()
                .collect(Collectors.toMap(TeamEditionEntity::getId, e -> e));
        List<TeamEditionPostEntity> priorPosts =
                posts.findByEditionIdInOrderByEditionIdAscRankAsc(editionsById.keySet());
        List<PriorShowing> out = new ArrayList<>();
        for (TeamEditionPostEntity post : priorPosts) {
            TeamEditionEntity edition = editionsById.get(post.getEditionId());
            String sourceKey = post.getSourceKind() + ":" + post.getSourceId();
            out.add(new PriorShowing(sourceKey, edition.getGeneratedAt()));
        }
        return out;
    }
}
