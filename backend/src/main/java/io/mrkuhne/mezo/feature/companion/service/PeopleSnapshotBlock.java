package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrend;
import io.mrkuhne.mezo.feature.people.service.PersonChatContext;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * mezo-x6oa: az {@code [Emberek]} blokk a chat kontextus-pillanatképében — az aktív emberi kör,
 * soronként név · kapcsolat · e heti említésszám · hangulat-irány (indok), hogy a companion egy
 * említett nevet felismerjen és óvatosan utaljon rá. Nyers idézet, ismert tény, jegyzet SOSEM
 * kerül ide (a prompt-szabály a {@code ChatService.SYSTEM_PROMPT}-ban tiltja a kitalálást).
 *
 * <p>A {@code companion → people} él már létezik ({@code ChatMentionListener}), ezért közvetlen
 * import; de a PEOPLE_SWITCH független a COMPANION_SWITCH-től, így a {@link PeopleService} bean
 * hiányozhat — {@link ObjectProvider} + {@code getIfAvailable()}, a {@code HabitService}
 * precedens. Csak a chat-variáns hívja ({@code ContextSnapshotAssembler#render}); a reggeli
 * üzenet ({@code renderWithoutBiometrics}) szándékosan nem — az proaktív felhozás lenne.
 *
 * <p>IDENT-3: a pillanatkép a {@code ChatService.prepareTurn} tranzakciójában épül. Ez a blokk
 * catch-eli a {@link RuntimeException}-t — egy NEM-adatbázis hiba esetén tényleg warn +
 * {@code nincs adat}-tal fut tovább a hívó tranzakció. DE a {@code PeopleService.chatContext}
 * {@code @Transactional(readOnly = true)}, tehát csatlakozik a körülvevő tranzakcióhoz: egy onnan
 * érkező {@link org.springframework.dao.DataAccessException} rollback-only-ra állítja a Hibernate
 * sessiont, és ezt a catch NEM oldja fel — a turn a commit-nál akkor is elhal, a log-üzenet
 * ellenére. Ugyanaz a veszély, amit a {@code MemoryEmbeddingAnnQuery} kerül el. A catch-only minta
 * bevett precedens ({@code GraphPromptAssembler}) — szándékosan NEM bővítjük savepoint-tal itt;
 * csak a dokumentált állítást igazítjuk a valósághoz.
 * A cap ({@code snapshot.people-max-persons}) a fogyasztó döntése; {@code 0} → a blokk teljesen
 * elmarad (üres string).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PeopleSnapshotBlock {

    static final String HEADER_PREFIX = "[Emberek]";
    static final String NO_DATA = HEADER_PREFIX + " " + ContextSnapshotAssembler.NO_DATA;

    private final ObjectProvider<PeopleService> peopleService;
    private final CompanionProperties properties;

    /** "" when the block is configured off; otherwise the full block WITHOUT a trailing newline. */
    public String render(UUID userId, LocalDate today) {
        int max = properties.snapshot().peopleMaxPersons();
        if (max == 0) {
            return "";
        }
        try {
            PeopleService service = peopleService.getIfAvailable();
            if (service == null) {
                return NO_DATA;
            }
            List<PersonChatContext> circle = service.chatContext(userId, today);
            if (circle.isEmpty()) {
                return NO_DATA;
            }
            StringBuilder b = new StringBuilder(HEADER_PREFIX)
                .append(" (aktív kör, utolsó említés szerint, max ").append(max).append(')');
            circle.stream().limit(max).forEach(p -> b.append('\n').append(line(p)));
            return b.toString();
        } catch (RuntimeException e) {
            log.warn("[Emberek] block render failed for user {} — degrades to 'nincs adat'; note that a "
                    + "DataAccessException here still poisons ChatService.prepareTurn's surrounding "
                    + "transaction despite this catch (IDENT-3)", userId, e);
            return NO_DATA;
        }
    }

    /** Newline/control chars, then length, {@code api/feature/people/people.yml:409,417}'s maxLength. */
    private static final int FIELD_MAX_CHARS = 120;
    private static final Pattern CONTROL_OR_VERTICAL_WS = Pattern.compile("[\\r\\n\\t\\x0B\\f\\p{Cc}]+");
    private static final Pattern SPACE_RUN = Pattern.compile(" {2,}");

    static String line(PersonChatContext p) {
        String week = p.mentionsThisWeek() > 0
            ? p.mentionsThisWeek() + "× e héten"
            : "e héten nem került szóba";
        return sanitize(p.name()) + " — " + sanitize(p.relationshipHu()) + " · " + week + " · " + direction(p);
    }

    /**
     * mezo-x6oa final-review (finding A): {@code name}/{@code relationshipHu} are contract-length-
     * capped but NOT newline-stripped on the way in ({@code PeopleService.applyEditableFields} only
     * {@code strip()}s the ends) — an embedded {@code \n} would otherwise render as a second
     * [Emberek] line, indistinguishable from a real snapshot block. Same shape as
     * {@code PromptMemoryAssembler.oneLine} (strip + length cap), but collapses embedded control /
     * vertical whitespace to a single space rather than truncating at the first line — here the
     * WHOLE value is a single rendered field, not a multi-line gist.
     */
    static String sanitize(String value) {
        String collapsed = CONTROL_OR_VERTICAL_WS.matcher(value).replaceAll(" ");
        collapsed = SPACE_RUN.matcher(collapsed).replaceAll(" ").strip();
        return collapsed.length() > FIELD_MAX_CHARS ? collapsed.substring(0, FIELD_MAX_CHARS) + "…" : collapsed;
    }

    private static String direction(PersonChatContext p) {
        String reason = p.directionReason();
        return switch (p.direction()) {
            case PersonAffectTrend.DIRECTION_UP -> reason == null ? "felfelé" : "felfelé (" + reason + ")";
            case PersonAffectTrend.DIRECTION_DOWN -> reason == null ? "lefelé" : "lefelé (" + reason + ")";
            default -> reason == null ? "kiegyensúlyozott" : reason;
        };
    }
}
