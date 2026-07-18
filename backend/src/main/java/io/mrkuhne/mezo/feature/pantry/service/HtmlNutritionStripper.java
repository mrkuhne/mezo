package io.mrkuhne.mezo.feature.pantry.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

/**
 * Reduces a product page to LLM-prompt-sized visible text (mezo-8vum): drops chrome
 * (script/style/nav/header/footer/iframe/svg), flattens table rows to "label: value" lines
 * (nutrition tables survive layout changes that way), and truncates to a char budget.
 */
@Component
public class HtmlNutritionStripper {

    public String strip(String html, int maxChars) {
        Document doc = Jsoup.parse(html);
        doc.select("script, style, nav, header, footer, iframe, svg, noscript, form").remove();
        StringBuilder tables = new StringBuilder();
        for (Element row : doc.select("table tr")) {
            var cells = row.select("th, td");
            if (cells.size() >= 2) {
                tables.append(cells.get(0).text().strip()).append(": ")
                      .append(cells.get(1).text().strip()).append('\n');
            }
        }
        doc.select("table").remove();
        String text = tables + "\n" + doc.body().text();
        return text.length() <= maxChars ? text : text.substring(0, maxChars);
    }
}
