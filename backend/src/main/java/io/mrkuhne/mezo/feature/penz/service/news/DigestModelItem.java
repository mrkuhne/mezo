package io.mrkuhne.mezo.feature.penz.service.news;

/**
 * One entry of the model's answer, as parsed (mezo-r36n9.104) — untrusted until {@link DigestValidator} passes it.
 * {@code confidence} is null when the model sent something that is not an integer.
 */
public record DigestModelItem(String story, boolean keep, String title, String verdict, String body,
                              Integer confidence, String uncertainty, String noAction) {
}
