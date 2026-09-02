package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrend;
import io.mrkuhne.mezo.feature.people.service.PersonChatContext;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
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
 * <p>IDENT-3: a pillanatkép a {@code ChatService.prepareTurn} tranzakciójában épül — ez a blokk
 * sosem dob; bármely hiba warn + {@code nincs adat}. A cap ({@code snapshot.people-max-persons})
 * a fogyasztó döntése; {@code 0} → a blokk teljesen elmarad (üres string).
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
            log.warn("[Emberek] block skipped for user {} — the turn continues without it", userId, e);
            return NO_DATA;
        }
    }

    static String line(PersonChatContext p) {
        String week = p.mentionsThisWeek() > 0
            ? p.mentionsThisWeek() + "× e héten"
            : "e héten nem került szóba";
        return p.name() + " — " + p.relationshipHu() + " · " + week + " · " + direction(p);
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
