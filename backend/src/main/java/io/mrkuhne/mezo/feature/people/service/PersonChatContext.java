package io.mrkuhne.mezo.feature.people.service;

import java.time.Instant;
import java.util.List;

/**
 * Egy személy sora a companion chat kontextus-pillanatképéhez (mezo-x6oa). Lapos, számított
 * mezők — pontosan az, amit a rendszerprompt megkaphat: nyers idézet és jegyzet SOSEM utazik itt
 * (a spec §4.3 „felismerés + óvatos utalás" határa). S3 (mezo-d6ivw.3) óta a NORMALIZÁLT
 * személy-tények (aktív + bekapcsolt {@code person_fact} sorok, előre formázva, sapkázva) viszont
 * igen — a legacy {@code person.known_facts} változatlanul sosem.
 *
 * @param name             a személy neve
 * @param relationshipHu   magyar kapcsolat-címke (pl. „barát")
 * @param mentionsThisWeek említések száma az elmúlt 7 napban (a bootstrap képlete)
 * @param lastMentionAt    a legfrissebb nem törölt említés ideje; {@code null}, ha sosem került szóba
 * @param direction        {@code up} | {@code down} | {@code flat} ({@link PersonAffectTrend})
 * @param directionReason  magyar indoklás; {@code null}, ha nincs olvasat
 * @param facts            előre formázott tény-sorok („fajta-címke: szöveg"), legfeljebb 3
 */
public record PersonChatContext(String name, String relationshipHu, int mentionsThisWeek,
    Instant lastMentionAt, String direction, String directionReason, List<String> facts) {}
