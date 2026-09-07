package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorPointQuery;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorPointQuery.PointRow;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Server-side PCA of one user's ready vectors (mezo-4qyt): 768 dims -&gt; 50, so the client's UMAP
 * gets ~0.6 MB instead of ~9 MB per 3 000 items.
 *
 * <p>Power iteration rather than a linear-algebra dependency: the matrices are (few thousand) x
 * 768 and 50 components converge in a handful of passes each, so the whole thing is a few hundred
 * milliseconds of pure Java and adds nothing to the build.
 *
 * <p>DETERMINISM IS A CONTRACT, not a nicety: the client caches the UMAP result per user in
 * sessionStorage and places a replayed query into the SAME space with {@link #transform}, so two
 * calls for one user must return the same basis. The random start vector is therefore seeded from
 * the user id (never {@code Math.random}), and the cache is keyed on the exact facts that can
 * change the input: the ready-vector count, the newest {@code memory_item.updated_at}, the
 * generation, and the caller's own dims/threshold request.
 *
 * <p>KNOWN LIMIT: the cache is a per-instance {@link ConcurrentHashMap}. Fine at this scale, but
 * two backend replicas can hand two clients two different bases, and the frontend caches its UMAP
 * per user in {@code sessionStorage} — so a page reload served by the other replica can make the
 * map jump. Documented rather than solved; a shared cache is not worth it for an owner-only
 * surface.
 *
 * <p>The tuning knobs ({@code pca-target-dims}, {@code vector-sample-threshold}) belong to the
 * ADMIN slice's {@code AdminMemoryProperties} and arrive as a {@link ProjectionRequest} parameter
 * instead of an injected dependency: {@code feature/companion} may never import
 * {@code feature/admin} (the ArchUnit {@code feature_slices_are_cycle_free} rule), so the plan's
 * sketch of injecting {@code AdminMemoryProperties} here would have failed the build.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryProjectionService {

    private static final long SEED = 0x5EEDL;
    private static final long COMPONENT_SALT = 0x9E3779B9L;
    private static final int MAX_ITERATIONS = 64;
    private static final double CONVERGENCE = 1e-7;

    /** What the caller wants projected — the admin-owned knobs, passed rather than injected. */
    public record ProjectionRequest(
            String embeddingVersion, int targetDims, int sampleThreshold, int snippetChars) {}

    /** One user's projection: the basis (for transform), the coordinates, and the honesty flags. */
    public record Projection(
            String embeddingVersion, int dims, boolean sampled, long total,
            List<PointRow> items, float[][] coordinates, double[] mean, double[][] basis) {}

    private final MemoryVectorPointQuery pointQuery;
    private final Map<UUID, Cached> cache = new ConcurrentHashMap<>();

    /**
     * The user's PCA projection, from cache when nothing that feeds it has changed.
     *
     * <p>Deliberately NOT a TTL cache: a stale map is worse than a recomputed one, so the probe
     * asks the DB the two cheap questions that decide it.
     */
    public Projection project(UUID userId, ProjectionRequest request) {
        MemoryVectorPointQuery.Probe probe = pointQuery.probe(userId, request.embeddingVersion());
        Cached cached = cache.get(userId);
        if (cached != null && cached.matches(probe, request)) {
            return cached.projection();
        }
        Projection projection = compute(userId, request, probe.readyCount());
        cache.put(userId, new Cached(
                probe.readyCount(), probe.newestUpdatedAt(), request, projection));
        return projection;
    }

    /** Places one 768-dim query vector into an existing basis — the replay's queryProjection. */
    public float[] transform(Projection projection, float[] queryVector) {
        float[] out = new float[projection.dims()];
        for (int k = 0; k < projection.dims(); k++) {
            double dot = 0.0;
            for (int d = 0; d < Math.min(queryVector.length, projection.mean().length); d++) {
                dot += (queryVector[d] - projection.mean()[d]) * projection.basis()[k][d];
            }
            out[k] = (float) dot;
        }
        return out;
    }

    /**
     * Loads at most {@code sampleThreshold + 1} points so "exactly at the threshold" and "over
     * it" are distinguishable, mean-centres them, then extracts {@code dims} components by power
     * iteration with deflation.
     */
    private Projection compute(UUID userId, ProjectionRequest request, long total) {
        List<PointRow> loaded = pointQuery.points(
                userId, request.embeddingVersion(), request.snippetChars(), request.sampleThreshold() + 1);
        boolean sampled = loaded.size() > request.sampleThreshold();
        List<PointRow> items = sampled ? List.copyOf(loaded.subList(0, request.sampleThreshold())) : loaded;

        int n = items.size();
        int width = n == 0 ? EmbeddingPort.DIMENSIONS : items.getFirst().embedding().length;
        int dims = Math.max(1, Math.min(Math.min(request.targetDims(), Math.max(n, 1)), width));
        if (n < 2) {
            // Fewer than two points have no variance to decompose: zero coordinates rather than a
            // division by zero, and `dims` still tells the client how wide its Float32Array is.
            return new Projection(request.embeddingVersion(), dims, sampled, total, items,
                    new float[n][dims], new double[width], new double[dims][width]);
        }

        double[] mean = new double[width];
        for (PointRow row : items) {
            for (int d = 0; d < width; d++) {
                mean[d] += row.embedding()[d];
            }
        }
        for (int d = 0; d < width; d++) {
            mean[d] /= n;
        }
        double[][] centred = new double[n][width];
        for (int i = 0; i < n; i++) {
            for (int d = 0; d < width; d++) {
                centred[i][d] = items.get(i).embedding()[d] - mean[d];
            }
        }

        double[][] basis = new double[dims][];
        float[][] coordinates = new float[n][dims];
        for (int k = 0; k < dims; k++) {
            double[] component = dominantComponent(centred, width, userId, k);
            basis[k] = component;
            double[] scores = new double[n];
            for (int i = 0; i < n; i++) {
                scores[i] = dot(centred[i], component);
                coordinates[i][k] = (float) scores[i];
            }
            // Deflate with the scores computed BEFORE subtracting: this is what keeps the
            // components orthogonal. Skipping it does NOT "converge to a different vector
            // anyway" — every later iteration would return the same first component.
            for (int i = 0; i < n; i++) {
                for (int d = 0; d < width; d++) {
                    centred[i][d] -= scores[i] * component[d];
                }
            }
        }
        return new Projection(
                request.embeddingVersion(), dims, sampled, total, items, coordinates, mean, basis);
    }

    /** {@code v <- normalise(Xᵀ(Xv))} until the L2 delta settles; deterministic start vector. */
    private static double[] dominantComponent(double[][] centred, int width, UUID userId, int k) {
        Random random = new Random(SEED ^ userId.getMostSignificantBits() ^ (k * COMPONENT_SALT));
        double[] v = new double[width];
        for (int d = 0; d < width; d++) {
            v[d] = random.nextDouble() - 0.5;
        }
        normalise(v);
        double[] next = new double[width];
        for (int iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            Arrays.fill(next, 0.0);
            for (double[] rowVector : centred) {
                double projected = dot(rowVector, v);
                for (int d = 0; d < width; d++) {
                    next[d] += projected * rowVector[d];
                }
            }
            if (!normalise(next)) {
                // Xᵀ(Xv) = 0 means Xv = 0, i.e. the deflated matrix has no variance left at all.
                // Returning the ZERO vector rather than the random start is what keeps
                // transform() consistent with coordinates(): both then yield 0 for this
                // component, instead of transform projecting onto a meaningless random axis the
                // stored coordinates were never computed against.
                return new double[width];
            }
            double delta = 0.0;
            for (int d = 0; d < width; d++) {
                double difference = next[d] - v[d];
                delta += difference * difference;
            }
            System.arraycopy(next, 0, v, 0, width);
            if (Math.sqrt(delta) < CONVERGENCE) {
                break;
            }
        }
        return v;
    }

    private static double dot(double[] a, double[] b) {
        double sum = 0.0;
        for (int i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    /** Normalises in place; false when the vector is (numerically) zero. */
    private static boolean normalise(double[] vector) {
        double norm = Math.sqrt(dot(vector, vector));
        if (norm < 1e-12) {
            return false;
        }
        for (int i = 0; i < vector.length; i++) {
            vector[i] /= norm;
        }
        return true;
    }

    /** The cache entry plus the exact facts that invalidate it. */
    private record Cached(long readyCount, Instant newestUpdatedAt, ProjectionRequest request,
                          Projection projection) {

        boolean matches(MemoryVectorPointQuery.Probe probe, ProjectionRequest other) {
            return readyCount == probe.readyCount()
                    && Objects.equals(newestUpdatedAt, probe.newestUpdatedAt())
                    && request.equals(other);
        }
    }
}
