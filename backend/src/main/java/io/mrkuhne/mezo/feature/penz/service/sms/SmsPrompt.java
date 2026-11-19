package io.mrkuhne.mezo.feature.penz.service.sms;

import java.util.List;

/**
 * The bank-SMS parse prompt (Boop Pénz L4, mezo-r36n9.102) — the old app's {@code buildPrompt} +
 * {@code PARSE_SCHEMA} ({@code base44/functions/ingest-sms/logic.ts}), split into a STABLE system prompt (the
 * rules and the inline JSON schema; Java constant, ADR 0012) and a per-SMS user message (sender, text, the
 * owner's category names). The first line is the marker the test fake dispatches on.
 */
public final class SmsPrompt {

    /** First line of {@link #SYSTEM_PROMPT}; mirrored literally by {@code FakeCompanionLlm}. */
    public static final String MARKER = "BOOP_PENZ_SMS_V1";

    /** The inline JSON schema (the old {@code PARSE_SCHEMA}). */
    static final String SCHEMA = """
        {"type":"object","properties":{
          "is_transaction":{"type":"boolean"},
          "direction":{"type":"string","enum":["debit","credit"]},
          "amount":{"type":"number","exclusiveMinimum":0,"description":"Positive amount in major units"},
          "currency":{"type":"string","description":"3-letter ISO currency code"},
          "merchant":{"type":"string"},
          "date":{"type":"string","description":"YYYY-MM-DD or empty"},
          "category":{"type":"string","description":"One of the given category names or empty"}},
         "required":["is_transaction"]}""";

    public static final String SYSTEM_PROMPT = MARKER + "\n" + """
        You are reading a Hungarian bank SMS. Extract the transaction fields as JSON.

        Fields: is_transaction, direction (debit|credit), amount (positive number in major units), \
        currency (3-letter ISO), merchant, date (YYYY-MM-DD or empty), category.
        Direction: "terhelés", "vásárlás" or a minus sign means debit; "jóváírás" or "érkezett" means credit.
        Amount: the amount of THIS transaction exactly as written in the SMS (a Hungarian SMS groups thousands \
        with a space or a dot and writes decimals after a comma: "15 500 HUF" is 15500, "12,50 EUR" is 12.5). \
        Never the balance ("Egyenleg") and never a sum you computed.
        Merchant: a readable name without store numbers or city, e.g. "ALDI 152. BUDAPEST" becomes "Aldi".
        Category: choose only from the list in the message, or leave empty if none fits.
        Set is_transaction to false for OTP codes, login notices, marketing and balance-only texts.

        Answer with ONE JSON object and nothing else, matching this schema:
        """ + SCHEMA;

    private SmsPrompt() {
    }

    /** The per-SMS half: the sender, the text and ONLY the owner's category names. */
    public static String userMessage(String text, String sender, List<String> categoryNames) {
        return "Category list: " + String.join(", ", categoryNames) + "\n"
            + "Sender: " + sender + "\n"
            + "SMS text: " + text;
    }
}
