# 0014 — Own `techcore/webpush` implementation instead of `nl.martijndwars:web-push`

- **Status:** Accepted
- **Date:** 2026-07-29
- **Driver:** `mezo-h4wp.6.1`

## Context

The push-notification delivery spine (N1 of the push-notification slice, spec
[`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../superpowers/specs/2026-07-29-push-notifications-design.md)
§4) needs a Web Push client: VAPID **ES256** application-server authentication (RFC 8292) and
**RFC 8291 `aes128gcm`** payload encryption (built on RFC 8188's content-encoding framing). Neither
is exotic cryptography — both RFCs publish worked examples/test vectors — but both require exact
byte-level handling: DER↔JOSE signature conversion, HKDF-SHA256 key derivation, and precise
RFC 8188 record framing. Getting any of these subtly wrong produces a push service response of
`400 Bad Request` and nothing ever arriving on the device, with little to debug from.

The obvious alternative is a library. The dominant one on the JVM is
`nl.martijndwars:web-push`.

## Decision

Implement Web Push in-house as `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/` —
`WebPushProperties`, `VapidSigner`, `Aes128GcmEncryptor`, `WebPushClient`, `WebPushResult`,
`WebPushSubscriptionKeys` — using only the JDK's own crypto primitives (`java.security.Signature`,
`KeyFactory`, `KeyAgreement`, `javax.crypto.{Cipher,Mac}`) plus the existing `RestClient`. **Zero
new Maven dependencies.**

## Rejected: `nl.martijndwars:web-push`

- **Unmaintained since ~2022** — no release validated against Spring Boot 4 / Java 21, the exact
  stack this project is on.
- **Drags in BouncyCastle + jose4j** — two additional dependencies (plus their transitive CVE
  surface) to get ~250 lines of standard-primitive assembly that the JDK alone can do.
- No test-vector-level confidence signal was available for how it behaves on this project's JDK —
  adopting it would trade a provable in-house implementation for an opaque, stale one.

## Consequences

- **~250 lines to own and maintain**, not a dependency to track for CVEs/updates. The entire
  surface is six small classes in `techcore/webpush/`.
- **Correctness is pinned by RFC test vectors, not by trust:** `Aes128GcmEncryptorTest` reproduces
  the **RFC 8291 §5 "Push Message Encryption Example"** byte-for-byte, transcribed from the RFC
  text and independently replayed in a throwaway Python script before any Java existed.
  `VapidSignerCodecTest` runs a **25-combo deterministic matrix** over the DER↔JOSE padding edge
  cases (short `r`/`s`, the DER high-bit sign byte) — the exact bug class that passes a
  single-keypair happy-path test and then fails ~0.25–50% of the time depending on the shape drawn.
  Both were mutation-tested: a deliberate regression was reintroduced into the implementation and
  confirmed caught before being trusted.
- **A JDK behavior had to be discovered and worked around, not assumed:** `KeyFactory` happily
  constructs an `ECPublicKey` from coordinates that fail the P-256 curve equation —
  `VapidSigner.decodePublicKey` alone is **not** a curve-membership check. The actual RFC
  8291 §7-mandated rejection of an off-curve point only happens inside `KeyAgreement.doPhase`
  during `Aes128GcmEncryptor.encrypt`, which is why curve validation is implemented there (mapped
  to `WEBPUSH_KEY_INVALID`/400) rather than at key-decode time. Owning the implementation is what
  made this discoverable and testable at all; a black-box library would have hidden it.
- **A misconfigured VAPID key now fails loudly, by design:** `VapidSigner.decodePrivateKey` rejects
  a scalar that is not exactly 32 bytes, is zero, or is ≥ the curve order — a fix added after
  review found that the original code silently accepted the `application.yml` dummy default and
  produced a well-formed but useless token, meaning every push would 401 forever with no
  diagnostic. Owning the code meant this could be tightened the moment it was found, rather than
  waiting on an upstream release.
- **Capability-URL redaction is our own responsibility, and it is easy to get wrong.** Push
  endpoints must never be logged in full (whoever holds one can trigger a push to that device);
  `WebPushClient` scrubs `https?://\S+` out of any caught exception message before logging, because
  Spring's own `ResourceAccessException` embeds the complete URI in its message. This is a security
  property this implementation must maintain itself on every future change to the send path — there
  is no library boundary enforcing it.

## Alternatives considered

- **`nl.martijndwars:web-push`** — rejected: unmaintained (~2022), no Spring Boot 4/Java 21
  validation, adds BouncyCastle + jose4j for a ~250-line problem.
- **A different/newer Java Web Push library** — none surveyed offered a materially better
  maintenance signal than the above at the time of this decision; the RFC test-vector approach
  makes in-house at least as trustworthy as adopting an unfamiliar new dependency.
- **Deferring push entirely and revisiting the library landscape later** — rejected: N1's spike
  (a real push to a real iPhone) is this slice's whole exit criterion (spec §10), and the protocol
  work is the same size regardless of when it happens.
