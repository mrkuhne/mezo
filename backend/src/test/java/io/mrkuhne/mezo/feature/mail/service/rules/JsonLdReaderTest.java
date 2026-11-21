package io.mrkuhne.mezo.feature.mail.service.rules;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class JsonLdReaderTest {

    @Test
    void invoiceGivesDeadlineWithDueDateAndAmount() {
        var v = JsonLdReader.read(List.of("{\"@type\":\"Invoice\",\"paymentDueDate\":\"2026-12-05\","
                + "\"totalPaymentDue\":{\"@type\":\"PriceSpecification\",\"price\":12990,\"priceCurrency\":\"HUF\"}}"));
        assertThat(v).isPresent();
        assertThat(v.get().group()).isEqualTo(Group.DEADLINE);
        assertThat(v.get().fields()).containsEntry("paymentDueDate", "2026-12-05")
                .containsEntry("totalPaymentDue", "12990 HUF");
    }

    @Test
    void eventReservationFoundInsideGraph() {
        var v = JsonLdReader.read(List.of("{\"@graph\":[{\"@type\":\"Organization\"},"
                + "{\"@type\":\"EventReservation\",\"reservationFor\":{\"name\":\"Minta koncert\","
                + "\"startDate\":\"2026-12-12T19:00\"}}]}"));
        assertThat(v).isPresent();
        assertThat(v.get().group()).isEqualTo(Group.DEADLINE);
        assertThat(v.get().fields()).containsEntry("reservationFor", "Minta koncert");
    }

    @Test
    void malformedBlockIsSkippedAndNextOneRead() {
        var v = JsonLdReader.read(List.of("{not json", "[{\"@type\":\"ParcelDelivery\",\"trackingNumber\":\"T9\"}]"));
        assertThat(v).isPresent();
        assertThat(v.get().fields()).containsEntry("trackingNumber", "T9");
    }

    @Test
    void unknownTypeGivesNothing() {
        assertThat(JsonLdReader.read(List.of("{\"@type\":\"Organization\"}"))).isEmpty();
    }
}
