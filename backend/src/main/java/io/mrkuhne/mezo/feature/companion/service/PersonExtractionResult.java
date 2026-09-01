package io.mrkuhne.mezo.feature.companion.service;

/** Az éjszakai people-kör egy user/nap kimenete (GraphMaintenanceJob logsora). {@code edgeLinked}
 *  (S5, mezo-06o0.4): hány aktív PERSON node esetén futott le ténylegesen az él-strukturálás
 *  KÍSÉRLETE ma éjjel — nem az, hogy hány node kapott ténylegesen ÉLT (a strukturáló válasza
 *  lehet üres, vagy minden javaslata a konfidencia-küszöb alatt maradhat; lásd
 *  {@code PersonExtractionService.linkPersonEdges} javadocja). */
public record PersonExtractionResult(int enriched, int candidates, int edgeLinked) {
    public static final PersonExtractionResult ZERO = new PersonExtractionResult(0, 0, 0);
}
