package io.mrkuhne.mezo.feature.people;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the owner's IDENT-5 PERMA-R inner circle (5 persons) under plain {@code demodata} —
 * a deliberate exception to the "demo content → demofixtures" rule: these are the owner's real
 * people (roadmap §E, plan 2026-07-04-people-slice-e-plan.md decision 1), akin to
 * {@link io.mrkuhne.mezo.feature.auth.OwnerSeedData}, and v1 has no person-create UI, so an
 * unseeded deploy would leave the Emberek tab unusable. Mention-derived stats are NOT seeded —
 * they are computed from live mention rows. Idempotent: no-op if any person exists.
 */
@Component
@Profile("demodata")
@Order(130) // after OwnerSeedData (0) — needs the seeded owner
@RequiredArgsConstructor
public class PeopleSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final PersonRepository personRepository;

    /** CommandLineRunner entry point (startup). */
    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by integration tests to re-seed into a reset DB. */
    @Transactional
    public void run() {
        if (personRepository.count() > 0) return;
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow();
        UUID ownerId = owner.getId();
        personRepository.saveAll(List.of(
            person(ownerId, "Petra", "P", "partner", "Élettárs", "positive", "Napi",
                "Közös háztartás · vasárnapi közös vacsorák a fix horgony.",
                List.of(
                    "Munkahely: ELTE doktorátus, jellemzően csüt-pénteken késő",
                    "Allergén: kagyló · konyhakerülő",
                    "Közös mozgás: vasárnap reggeli séta a Duna-parton"),
                List.of(
                    "Csütörtökönként későn jön → vacsora csúszik 21:00 utánra",
                    "Vasárnapi séta után stabilan jobb hét"),
                List.of(4, 4, 3, 4, 4, 3, 4, 5, 4, 4, 4, 5)),
            person(ownerId, "Bence", "B", "teammate", "Csapattárs · röpi", "positive", "Heti 3×",
                "Röplabda csapat · setter · 6 éve együtt játszunk.",
                List.of(
                    "Csütörtök 18:00 + Vasárnap 10:00 közös edzés",
                    "Cipője utoljára májusban cserélve · figyel a térdére"),
                List.of("Bence játéknapja után stabilan magasabb HRV"),
                List.of(4, 4, 4, 5, 4, 4, 5, 4, 5, 4)),
            person(ownerId, "Ádám", "Á", "mentee", "Mentee · Mizu Velünk", "positive", "Havi 1:1",
                "Product manager · új rolet vesz fel · rendszer-szerelem közös téma.",
                List.of(
                    "Tanulja a glikogén ablakot · saját N=1-be belekezdett",
                    "Áprilisi 1:1: 'új ötlet-pörgés' 14 napos micro-experiment"),
                List.of("Mizu-péntek utáni szombat reggel: +0.8 SD energia"),
                List.of(3, 4, 4, 4, 5, 4)),
            person(ownerId, "Réka", "R", "mentee", "Mentee · Mizu Velünk", "mixed", "Havi 1:1 · spike most",
                "Karrier-átmenet · márciusi szakítás · sűrűsödő mentions.",
                List.of(
                    "Március óta nehezebb hónapok · 'lebegés' szót sokszor használja",
                    "Vasárnapi sétára meghívás többször visszamondva"),
                List.of("Réka-említés után 2× 22:00 utáni snack a múlt héten"),
                List.of(4, 3, 3, 3, 2, 3, 3, 2, 3)),
            person(ownerId, "Márk", "M", "mentee", "Mentee · Mizu Velünk", "positive", "Havi 1:1",
                "Önálló dev · system-thinker · Daniel-fit profil.",
                List.of(
                    "Saját kis Mezo-szerű naplót épít magának",
                    "Áprilisi 1:1: gain & loss framing együtt felfedezve"),
                List.of(),
                List.of(4, 5, 4, 5, 4, 4, 5))));
    }

    private PersonEntity person(UUID ownerId, String name, String initial, String relationship,
        String relationshipHu, String affectBaseline, String cadence, String notes,
        List<String> knownFacts, List<String> ties, List<Integer> affectTrend) {
        PersonEntity p = new PersonEntity();
        p.setCreatedBy(ownerId);
        p.setName(name);
        p.setInitial(initial);
        p.setRelationship(relationship);
        p.setRelationshipHu(relationshipHu);
        p.setAffectBaseline(affectBaseline);
        p.setContactCadenceLabel(cadence);
        p.setNotes(notes);
        p.setKnownFacts(knownFacts);
        p.setTies(ties);
        p.setAffectTrend(affectTrend);
        return p;
    }
}
