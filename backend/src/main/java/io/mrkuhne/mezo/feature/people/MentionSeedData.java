package io.mrkuhne.mezo.feature.people;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds a demo mention feed as <strong>opt-in demo content</strong> ({@code demofixtures}, the
 * {@link io.mrkuhne.mezo.feature.goal.GoalSeedData} precedent) — a plain {@code demodata} app
 * starts with an honest empty feed and real counts of 0. Timestamps are relative to startup
 * (now-minus-offsets) so the feed and the rolling-7d stats look alive at any demo date.
 * Idempotent: no-op if any mention exists.
 */
@Component
@Profile("demofixtures")
@Order(140) // after PeopleSeedData (130) — needs the seeded persons
@RequiredArgsConstructor
public class MentionSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final PersonRepository personRepository;
    private final MentionRepository mentionRepository;

    /** CommandLineRunner entry point (startup). */
    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by integration tests to re-seed into a reset DB. */
    @Transactional
    public void run() {
        if (mentionRepository.count() > 0) return;
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow();
        UUID ownerId = owner.getId();
        Map<String, UUID> byName = personRepository
            .findAllByCreatedByAndDeletedFalseOrderByNameAsc(ownerId).stream()
            .collect(Collectors.toMap(PersonEntity::getName, PersonEntity::getId));
        if (byName.isEmpty()) return; // no seeded persons (non-demodata run) → nothing to attach to
        Instant now = Instant.now();
        Function<String, UUID> id = byName::get;

        mentionRepository.saveAll(List.of(
            mention(ownerId, id.apply("Petra"), now.minus(Duration.ofHours(13)), "voice", 11,
                "Petrával hosszú vacsi · csendben, jó volt nem pörögni. Megnézte a tegnapi PR-videót velem.",
                "positive", "checkin", "Esti check-in · 21:00", false),
            mention(ownerId, id.apply("Réka"), now.minus(Duration.ofHours(35)), "voice", 47,
                "Réka hívott · másfél óra · munkahely, lakhatás. Megint a 'lebegés' szót használta. Holnap follow-up.",
                "mixed", "freenote", "Hangjegy · 22:18", true),
            mention(ownerId, id.apply("Bence"), now.minus(Duration.ofHours(39)), "chip", null,
                "Bence-vel röpi után gyors sör · 1 doboz · hazafelé séta.",
                "positive", "sport", "Volleyball · 17:30-19:00", false),
            mention(ownerId, id.apply("Petra"), now.minus(Duration.ofDays(2).plusHours(2)), "voice", 8,
                "Petra korán ment, magamnak főztem reggelit. Halk indítás, OK.",
                "neutral", "meal", "Reggeli · 08:10", false),
            mention(ownerId, id.apply("Petra"), now.minus(Duration.ofDays(3)), "voice", 19,
                "Vita a hétvégi tervekről · nem haragszunk, csak kifáradtunk mindketten. Aludni megyek.",
                "mixed", "sleep", "Lefekvés · 22:10", false),
            mention(ownerId, id.apply("Ádám"), now.minus(Duration.ofDays(4)), "text", null,
                "Ádámmal chat: 'a 7 napos glikogén kísérleten van' · küldtem neki a táblát.",
                "positive", null, null, false),
            mention(ownerId, id.apply("Ádám"), now.minus(Duration.ofDays(6)), "voice", 22,
                "Ádám átment azon a podcasten amit ajánlottam — rendszer-szerelem oldalról fogja.",
                "positive", null, null, false),
            mention(ownerId, id.apply("Réka"), now.minus(Duration.ofDays(6).plusHours(2)), "chip", null,
                "Réka SMS: 'nem leszek vasárnap'. Második visszamondás.",
                "mixed", null, null, true),
            mention(ownerId, id.apply("Petra"), now.minus(Duration.ofDays(7).plusHours(9)), "voice", 14,
                "Vasárnapi séta a Duna-parton, 45 perc. Erről fogok még emlékezni hetekig.",
                "positive", "sport", "Walk · 45 perc", false),
            mention(ownerId, id.apply("Márk"), now.minus(Duration.ofDays(9)), "voice", 38,
                "Áprilisi 1:1 — Márk megérzései a gain & loss framingről. Erre érdemes később visszatérni.",
                "positive", "event", "Mizu Velünk · havi", false)));
    }

    private MentionEntity mention(UUID ownerId, UUID personId, Instant ts, String source,
        Integer durationS, String excerpt, String tone, String tiedToKind, String tiedToLabel,
        boolean flagged) {
        MentionEntity m = new MentionEntity();
        m.setCreatedBy(ownerId);
        m.setPersonId(personId);
        m.setTs(ts);
        m.setSource(source);
        m.setDurationS(durationS);
        m.setExcerpt(excerpt);
        m.setTone(tone);
        m.setTiedToKind(tiedToKind);
        m.setTiedToLabel(tiedToLabel);
        m.setFlagged(flagged);
        return m;
    }
}
