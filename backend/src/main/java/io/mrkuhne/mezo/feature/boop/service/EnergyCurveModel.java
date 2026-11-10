package io.mrkuhne.mezo.feature.boop.service;

import java.time.LocalTime;

/**
 * Modelled energy across the day (Boop S3, mezo-r36n9.7) — pure. 19 hourly values for
 * 06:00…24:00 inclusive (index 0 = 06:00). A circadian template, scaled by the day's forma,
 * with the post-lunch dip and the training hour layered on. A model, not a measurement.
 */
public final class EnergyCurveModel {

    public static final int POINTS = 19;
    private static final int FIRST_HOUR = 6;
    private static final double[][] ANCHORS = {
        {6, 0.35}, {10, 0.82}, {11, 0.82}, {14, 0.38}, {15, 0.38}, {17, 0.66}, {18, 0.66}, {24, 0.2}};

    private EnergyCurveModel() {}

    /** Nullable {@code forma} = unknown (scale 0.8); nullable times = no session / unknown lunch. */
    public static double[] hourly(Integer forma, LocalTime sessionTime, LocalTime lunch) {
        double scale = forma == null ? 0.8 : 0.6 + 0.4 * forma / 100.0;
        double[] out = new double[POINTS];
        for (int i = 0; i < POINTS; i++) out[i] = template(FIRST_HOUR + i) * scale;
        if (lunch != null && lunch.isAfter(LocalTime.of(13, 30))) {
            add(out, 14, -0.05);
            add(out, 15, -0.05);
        }
        if (sessionTime != null) {
            int h = sessionTime.getHour();
            add(out, h, 0.06);
            add(out, h + 1, -0.08);
            add(out, h + 2, -0.08);
        }
        return out;
    }

    private static void add(double[] out, int hour, double delta) {
        int i = hour - FIRST_HOUR;
        if (i >= 0 && i < POINTS) out[i] += delta;
    }

    private static double template(double hour) {
        for (int a = 0; a < ANCHORS.length - 1; a++) {
            double[] p = ANCHORS[a], q = ANCHORS[a + 1];
            if (hour >= p[0] && hour <= q[0]) return p[1] + (q[1] - p[1]) * (hour - p[0]) / (q[0] - p[0]);
        }
        return ANCHORS[ANCHORS.length - 1][1];
    }
}
