package io.mrkuhne.mezo.feature.penz.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The computed content of one proposal — {@code penz_proposal.body} (jsonb), shaped like the contract's
 * {@code PenzProposal} minus the row fields (mezo-r36n9.105): the card lines, the (validated) narration, the
 * "miért?" facts and rules, and the three sleeves with their offered options. Written once at creation, never
 * re-derived — what he saw is what he accepts against.
 */
public record PenzProposalJson(String title, String sub, String summary, String uncertainty, String narratedBy,
                               List<Fact> facts, List<String> rules, List<SleeveJson> sleeves) {

    public static final String NARRATED_BY_MODEL = "model";
    public static final String NARRATED_BY_FALLBACK = "fallback";

    public PenzProposalJson {
        facts = facts == null ? List.of() : List.copyOf(facts);
        rules = rules == null ? List.of() : List.copyOf(rules);
        sleeves = sleeves == null ? List.of() : List.copyOf(sleeves);
    }

    public record Fact(String value, String unit, String label) {
    }

    public record SleeveJson(String sleeve, String label, long amountHufMinor, BigDecimal sharePct, String why,
                             String optionsNote, List<OptionJson> options) {

        public SleeveJson {
            options = options == null ? List.of() : List.copyOf(options);
        }
    }

    public record OptionJson(UUID productId, String name, String whatItIs, String kind, String currency,
                             String distribution, BigDecimal terPct, BigDecimal entryFeePct, String feeNote,
                             Long yearlyCostHufMinor, LocalDate reviewedAt, List<String> differs) {

        public OptionJson {
            differs = differs == null ? List.of() : List.copyOf(differs);
        }
    }

    /** One step of the accepted plan — an element of {@code penz_proposal.plan}. */
    public record StepJson(int index, String sleeve, UUID productId, String productName, long amountHufMinor,
                           boolean done, Instant doneAt) {
    }
}
