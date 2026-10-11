package io.mrkuhne.mezo.techcore.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** The Hungarian and English bundles must describe exactly the same messages (mezo-n4wf5.11). */
class MessageBundleParityTest {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\d+)\\}");

    private static Properties load(String name) throws IOException {
        Properties p = new Properties();
        try (InputStream in = MessageBundleParityTest.class.getResourceAsStream("/" + name);
             InputStreamReader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
            p.load(reader);
        }
        return p;
    }

    private static Set<String> placeholders(String value) {
        Set<String> found = new TreeSet<>();
        Matcher m = PLACEHOLDER.matcher(value);
        while (m.find()) {
            found.add(m.group(1));
        }
        return found;
    }

    @Test
    void both_bundles_hold_the_same_keys() throws IOException {
        assertThat(load("messages_en.properties").stringPropertyNames())
            .isEqualTo(load("messages_hu.properties").stringPropertyNames());
    }

    @Test
    void placeholders_match_per_key() throws IOException {
        Properties hu = load("messages_hu.properties");
        Properties en = load("messages_en.properties");
        for (String key : hu.stringPropertyNames()) {
            assertThat(placeholders(en.getProperty(key)))
                .as("placeholders of %s", key)
                .isEqualTo(placeholders(hu.getProperty(key)));
        }
    }

    @Test
    void no_value_is_blank() throws IOException {
        for (String bundle : new String[] {"messages_hu.properties", "messages_en.properties"}) {
            Properties p = load(bundle);
            for (String key : p.stringPropertyNames()) {
                assertThat(p.getProperty(key)).as("%s in %s", key, bundle).isNotBlank();
            }
        }
    }
}
