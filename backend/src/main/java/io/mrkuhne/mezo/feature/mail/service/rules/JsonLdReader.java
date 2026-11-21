package io.mrkuhne.mezo.feature.mail.service.rules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Reads schema.org JSON-LD blocks into a group and its fields (spec §5.4 step 1). Malformed blocks are skipped. */
public final class JsonLdReader {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private JsonLdReader() {}

    public static Optional<RuleVerdict.Structured> read(List<String> blocks) {
        for (String block : blocks) {
            List<JsonNode> nodes = new ArrayList<>();
            try {
                flatten(MAPPER.readTree(block), nodes);
            } catch (JacksonException e) {
                continue;
            }
            for (JsonNode node : nodes) {
                Optional<RuleVerdict.Structured> v = fromNode(node);
                if (v.isPresent()) {
                    return v;
                }
            }
        }
        return Optional.empty();
    }

    private static void flatten(JsonNode n, List<JsonNode> out) {
        if (n == null) {
            return;
        }
        if (n.isArray()) {
            n.forEach(c -> flatten(c, out));
        } else if (n.isObject()) {
            out.add(n);
            flatten(n.get("@graph"), out);
        }
    }

    private static Optional<RuleVerdict.Structured> fromNode(JsonNode n) {
        for (String type : types(n)) {
            switch (type) {
                case "ParcelDelivery":
                    return Optional.of(build(Group.PARCEL, n, "trackingNumber", "expectedArrivalFrom",
                            "expectedArrivalUntil", "carrier", "deliveryAddress"));
                case "Invoice":
                    return Optional.of(build(Group.DEADLINE, n, "paymentDueDate", "totalPaymentDue", "provider",
                            "paymentStatus"));
                case "EventReservation", "LodgingReservation", "FlightReservation", "FoodEstablishmentReservation",
                        "Event":
                    return Optional.of(build(Group.DEADLINE, n, "startDate", "startTime", "reservationFor", "name",
                            "checkinTime"));
                case "Offer", "Coupon", "DiscountOffer":
                    return Optional.of(build(Group.DEAL, n, "name", "price", "priceCurrency", "validThrough",
                            "discount", "itemOffered"));
                default:
                    break;
            }
        }
        return Optional.empty();
    }

    private static List<String> types(JsonNode n) {
        JsonNode t = n.get("@type");
        List<String> out = new ArrayList<>();
        if (t == null) {
            return out;
        }
        if (t.isArray()) {
            t.forEach(x -> out.add(simple(x.asString(""))));
        } else {
            out.add(simple(t.asString("")));
        }
        return out;
    }

    private static String simple(String type) {
        int i = Math.max(type.lastIndexOf('/'), type.lastIndexOf('#'));
        return i < 0 ? type : type.substring(i + 1);
    }

    private static RuleVerdict.Structured build(Group group, JsonNode n, String... keys) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (String k : keys) {
            String v = scalar(n.get(k));
            if (v != null && !v.isBlank()) {
                fields.put(k, v);
            }
        }
        return new RuleVerdict.Structured(group, fields);
    }

    private static String scalar(JsonNode v) {
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isValueNode()) {
            return v.asString("");
        }
        if (v.isObject()) {
            String name = scalar(v.get("name"));
            if (name != null) {
                return name;
            }
            String price = scalar(v.get("price"));
            if (price != null) {
                String cur = scalar(v.get("priceCurrency"));
                return cur == null ? price : price + " " + cur;
            }
            String date = scalar(v.get("startDate"));
            return date;
        }
        return null;
    }
}
