---
title: GPT-5.6 Luna
type: entity
updated: 2026-11-24
tags: [ai, tooling]
related: [../../features/companion.md, ../../features/fuel.md]
sources: [raw/articles/2026-11-24-gpt-5-6-luna-vision.md]
confidence: high
---

# GPT-5.6 Luna

OpenAI's low-cost model accepts image input and returns text through the Chat Completions API, the route used by mezo's Spring AI adapter. The official [model capability table](https://developers.openai.com/api/docs/models/gpt-5.6-luna) lists image input, no audio support, and the Chat Completions endpoint. The [image-input guide](https://developers.openai.com/api/docs/guides/images-vision?api-mode=chat) lists supported formats, including JPEG, PNG and WebP.

For mezo, this supports the [Companion](../../features/companion.md) vision route and the [Fuel](../../features/fuel.md) meal-photo draft. Capability is separate from extraction quality: a live synthetic probe read a clear nutrition label correctly, while a tiny-font version misread one number. Keep the deterministic validators and test representative photos when changing providers.
