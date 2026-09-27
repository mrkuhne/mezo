package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import java.util.Arrays;
import java.util.Optional;
import java.util.function.Function;

/**
 * The fourteen Check-in 2.0 items (mezo-ck2, spec §2.1) with their Hungarian copy — the exact
 * strings of the owner-approved prototype ({@code elo/nap.html}, {@code ITEMS}).
 *
 * <p>{@link #id()} is the wire/stored id ({@code check_in.asked_items}, {@code adaptive_item},
 * the contract's {@code CheckInItemId}); {@link #value} reads the item's answer off a row
 * (NULL = not answered); {@link #whyPhrase()} names the item inside the question-of-the-day
 * "why" sentence.
 */
public enum CheckInItem {
    ENERGY("energy", "Energia", "Mennyi energia van benned most?", "Üres", "Tele",
        Kind.SCALE, true, "az energiád", CheckInEntity::getEnergy),
    MOOD("mood", "Hangulat", "Milyen most a hangulatod?", "Nagyon rossz", "Nagyon jó",
        Kind.SCALE, true, "a hangulatod", CheckInEntity::getMood),
    STRESS("stress", "Stressz", "Mennyire vagy feszült most?", "Nyugodt", "Túlfeszült",
        Kind.SCALE, true, "a stressz", CheckInEntity::getStress),
    BODY("body", "Testi érzés", "Hogy érzi magát most a tested?", "Lerakva", "Friss",
        Kind.SCALE, true, "a testi érzés", CheckInEntity::getBody),
    MENTAL("mental", "Fejtisztaság", "Mennyire tiszta a fejed?", "Köd", "Éles",
        Kind.SCALE, true, "a fejtisztaság", CheckInEntity::getMental),
    RESTED("rested", "Kipihentség", "Mennyire pihented ki magad éjjel?", "Egyáltalán nem", "Teljesen",
        Kind.SCALE, false, "a kipihentséged", CheckInEntity::getRested),
    SORENESS("soreness", "Izomláz", "Mennyire van izomlázad?", "Nincs", "Nagyon erős",
        Kind.SCALE, false, "az izomlázad", CheckInEntity::getSoreness),
    /** Gate (Nem/Igen) → regions → intensity; low/high are the intensity anchors. */
    PAIN("pain", "Fájdalom", "Fáj valami?", "Alig", "Nagyon",
        Kind.PAIN, false, "a fájdalom", CheckInEntity::getPain),
    MOTIVATION("motivation", "Motiváció", "Mennyi kedved van a mai dolgaidhoz?", "Semmi", "Tele vagyok vele",
        Kind.SCALE, false, "a motivációd", CheckInEntity::getMotivation),
    HUNGER("hunger", "Éhség", "Mennyire vagy éhes most?", "Egyáltalán nem", "Nagyon",
        Kind.SCALE, false, "az éhséged", CheckInEntity::getHunger),
    /** Scale + kinds (asked from 4). */
    CRAVING("craving", "Sóvárgás", "Kívánsz most valamit?", "Nem", "Nagyon",
        Kind.CRAVING, false, "a sóvárgásod", CheckInEntity::getCraving),
    DIGESTION("digestion", "Emésztés", "Hogy érzi magát most a gyomrod?", "Nehéz, puffadt", "Könnyű, rendben",
        Kind.SCALE, false, "az emésztésed", CheckInEntity::getDigestion),
    CONNECTION("connection", "Kapcsolódás", "Mennyire érezted magad ma kapcsolódva másokhoz?", "Egyedül", "Nagyon",
        Kind.SCALE, false, "a kapcsolódásod", CheckInEntity::getConnection),
    DAY("day", "A nap mérlege", "Milyen volt a napod összességében?", "Nagyon rossz", "Nagyon jó",
        Kind.SCALE, false, "a nap mérlege", CheckInEntity::getDayRating);

    /** How the sheet renders the item (mirrors the contract's {@code CheckInItemKind}). */
    public enum Kind { SCALE, PAIN, CRAVING }

    private final String id;
    private final String label;
    private final String question;
    private final String low;
    private final String high;
    private final Kind kind;
    private final boolean core;
    private final String whyPhrase;
    private final Function<CheckInEntity, Object> value;

    CheckInItem(String id, String label, String question, String low, String high, Kind kind,
                boolean core, String whyPhrase, Function<CheckInEntity, Object> value) {
        this.id = id;
        this.label = label;
        this.question = question;
        this.low = low;
        this.high = high;
        this.kind = kind;
        this.core = core;
        this.whyPhrase = whyPhrase;
        this.value = value;
    }

    public String id() { return id; }
    public String label() { return label; }
    public String question() { return question; }
    public String low() { return low; }
    public String high() { return high; }
    public Kind kind() { return kind; }
    /** One of the five core items every slot asks first (the quick-exit threshold). */
    public boolean core() { return core; }
    /** The item named inside the "why" sentence, e.g. "az éhséged". */
    public String whyPhrase() { return whyPhrase; }

    /** The row's answer for this item; {@code null} = not answered. */
    public Object value(CheckInEntity row) {
        return value.apply(row);
    }

    /** Lookup by wire id ({@code "energy"}); empty for an unknown id. */
    public static Optional<CheckInItem> byId(String id) {
        return Arrays.stream(values()).filter(i -> i.id.equals(id)).findFirst();
    }
}
