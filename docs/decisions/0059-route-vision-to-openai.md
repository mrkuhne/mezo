# 0059 — Route image analysis to OpenAI

- **Status:** Accepted
- **Date:** 2026-11-24
- **Driver:** mezo-h38eq

## Context

Production uses OpenAI for text, but the September migration left all `VISION` calls on Gemini until a model comparison. On 2026-11-24, two meal-photo drafts failed at the Gemini API with `402 prepayment credits are depleted`. The iPhone showed a generic analysis error before a meal draft existed. The owner has funded OpenAI and chose to move every image-analysis route to it. GPT-5.6 Luna accepts image inputs on the existing Chat Completions path ([model capabilities](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [image-input guide](https://developers.openai.com/api/docs/guides/images-vision?api-mode=chat)).

## Decision

Remove the `VISION: gemini` exception from `mezo.companion.llm.per-call-kind`. With production's `provider: openai`, the existing `OpenAiCompanionLlm` handles all `VISION` calls on its cheap `gpt-5.6-luna` tier. Keep `TRANSCRIBE: gemini`, Gemini embeddings, and Gemini as the chat fallback. No iPhone or REST contract change is needed. Do not retry a failed OpenAI image request on Gemini: its prepaid balance is exhausted, and a cross-provider retry would spend twice when the first request fails after provider processing.

## Consequences

Meal, recipe, pantry-label, sleep-screenshot, and other image extraction calls now use OpenAI. Images are billed as input tokens there and remain ephemeral; the call audit retains metadata, not image bytes. The existing per-user budget and extraction validators remain in force. Model-output quality must be checked with synthetic examples for each route and monitored after release. Reverting this decision is a one-line `VISION: gemini` restoration, but that route cannot serve requests until its account is funded again.

## Alternatives considered

- **Top up Gemini:** restores the old route but keeps image analysis on a separate, unfunded provider; the owner chose the already funded OpenAI account.
- **Move only meal photos:** requires a new per-feature routing seam while other image features still fail on the same depleted Gemini balance.
