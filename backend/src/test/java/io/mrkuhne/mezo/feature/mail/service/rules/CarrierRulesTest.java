package io.mrkuhne.mezo.feature.mail.service.rules;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.mail.service.redact.RedactedMail;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CarrierRulesTest {

    private static RuleVerdict decide(String from, String subject, String text) {
        return MailRules.decide(new MailHeaders(from, "", subject, Map.of()), text,
                new RedactedMail("", List.of(), List.of()), List.of());
    }

    @Test
    void glsPickup() {
        assertThat(decide("noreply@gls-group.eu", "GLS csomag 12345678901", "A csomagod átvehető a csomagponton."))
                .isEqualTo(new RuleVerdict.Parcel("GLS", "12345678901", ParcelState.PICKUP));
    }

    @Test
    void foxpostToday() {
        assertThat(decide("info@foxpost.hu", "Csomagod CLFOX0123456789", "Ma kézbesítjük a csomagot."))
                .isEqualTo(new RuleVerdict.Parcel("Foxpost", "CLFOX0123456789", ParcelState.TODAY));
    }

    @Test
    void packetaDeliveredFromSubdomain() {
        assertThat(decide("no-reply@mail.packeta.hu", "Z123456789 kézbesítve", "Sikeresen átvetted."))
                .isEqualTo(new RuleVerdict.Parcel("Packeta", "Z123456789", ParcelState.DELIVERED));
    }

    @Test
    void mplInTransit() {
        assertThat(decide("ertesito@posta.hu", "RR123456789HU feladva", "A küldeményed úton van."))
                .isEqualTo(new RuleVerdict.Parcel("MPL", "RR123456789HU", ParcelState.IN_TRANSIT));
    }

    @Test
    void dpdTodayWithKeyFromBody() {
        assertThat(decide("info@dpd.hu", "DPD értesítő", "Csomagszám 12345678901234, ma érkezik hozzád."))
                .isEqualTo(new RuleVerdict.Parcel("DPD", "12345678901234", ParcelState.TODAY));
    }

    @Test
    void noTrackingNumberGivesStableHashKey() {
        RuleVerdict a = decide("info@foxpost.hu", "Csomagod úton van!", "x");
        RuleVerdict b = decide("info@foxpost.hu", "Csomagod  úton van", "y");
        assertThat(a).isInstanceOf(RuleVerdict.Parcel.class);
        assertThat(((RuleVerdict.Parcel) a).key()).startsWith("h-").isEqualTo(((RuleVerdict.Parcel) b).key());
    }

    @Test
    void carrierMailWithoutStatusOrTrackingIsNotAParcel() {
        assertThat(decide("info@gls-group.eu", "Nyári akciónk", "Rendelj most!"))
                .isNotInstanceOf(RuleVerdict.Parcel.class);
    }

    @Test
    void glsTrackingNumberOnlyInBodyIsTheKey() {
        assertThat(decide("noreply@gls-group.eu", "Értesítés a csomagodról", "Csomagszám: 123456789012. Átvehető."))
                .isEqualTo(new RuleVerdict.Parcel("GLS", "123456789012", ParcelState.PICKUP));
    }

    @Test
    void loginCodeIsReadFromRawText() {
        assertThat(decide("x@shop.example", "Belépés", "Az ellenőrző kód: 482913"))
                .isEqualTo(new RuleVerdict.Sensitive("2fa"));
    }

    @Test
    void pickupCodeIsAParcelNotALogin() {
        assertThat(decide("info@foxpost.hu", "Csomagod átvehető", "Átvételi kód: 482913"))
                .isInstanceOf(RuleVerdict.Parcel.class)
                .extracting(v -> ((RuleVerdict.Parcel) v).state()).isEqualTo(ParcelState.PICKUP);
    }

    @Test
    void couponCodesAreNotLogins() {
        assertThat(decide("deals@shop.example", "Kupon", "Használd a kuponkód 12345 kódot, promo code 2024"))
                .isNotInstanceOf(RuleVerdict.Sensitive.class);
    }

    @Test
    void bareSixDigitCodeStillSensitive() {
        assertThat(decide("x@shop.example", "Szia", "Kód: 482913")).isEqualTo(new RuleVerdict.Sensitive("2fa"));
    }
}
