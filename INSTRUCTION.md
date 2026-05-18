# FinAgent V2 Instructions

## Build Rules

- The Express server must always be bundled as ESM, not CJS, because `server.ts` uses `import.meta.url` for `createRequire`. Keep build output as `dist/server.mjs`.

## Changelog

| Date | What changed | Why |
| --- | --- | --- |
| 2026-05-19 | Added true reflection loop to Orchestrator: after all agents run, detectGaps() checks each requested topic against returned content; gaps trigger CIOAgent.synthesizeFromKnowledge() which fills them using LLM training knowledge with an AI-synthesis disclaimer. Added synthesize_knowledge as a first-class planner tool so the LLM can schedule knowledge synthesis proactively. | Enables the Orchestrator to truly synthesize across agent capabilities instead of silently returning empty sections when documents lack the requested data. |
| 2026-05-19 | Bug 1: Added ticker validation in App.tsx to reject inputs containing spaces or >20 chars, directing users to the Orchestrator chatbox instead. Bug 2: Rewrote PeerAgent prompt to extract company name, sector, and geography before selecting peers; added sector-specific guidance (e.g. Chinese consumer electronics → Samsung/Apple/Lenovo, not telecom carriers). Bug 3: QuantAgent now instructs LLM to extract 15 named valuation metrics; ValuationModels shows Forward PE, PEG, ROE, Revenue Growth, EBITDA Margin; DCF calculator exposes Terminal Growth Rate as a user input; Valuation section opens by default. | Fixes chatbox/ticker confusion, irrelevant peer selection, and simplified valuation output vs V1. |
| 2026-05-18 | Added natural-language orchestration input, OpenAI function-calling tool planning, real-time agent return summaries, and checkbox fallback preservation. | Makes Orchestrator choose Fundamental, Quant, Peer, and CIO agents from user intent instead of only hardcoded input-type branching. |
| 2026-05-18 | Removed the mixed static/dynamic `services/ai` import pattern and raised the Vite chunk warning limit for the current bundle size. | Keeps `npm run build` warning-free while preserving the production ESM server output. |
| 2026-05-18 | Changed production server build output from CJS `dist/server.cjs` to ESM `dist/server.mjs` and updated the start script. | Prevents `createRequire(import.meta.url)` from breaking in production bundles. |
| 2026-05-17 | Added OpenAI prompt and output caps and reduced FundamentalAgent report text length for OpenAI-first PDF analysis. | Keeps requests under the current OpenAI tokens-per-minute limit while preserving the same agent call signatures. |
| 2026-05-17 | Stopped attaching full PDF base64 data to OpenAI requests and documented the context-window issue in `README.md`. | Prevents OpenAI-first analysis from exceeding context limits by relying on extracted/truncated report text instead of duplicating the PDF payload. |
| 2026-05-17 | Documented the fixed OpenAI schema string mismatch and added a follow-up note to review OpenAI-first compute usage in `README.md`. | Keeps the known issue history and compute-cost review task visible for future checks. |
| 2026-05-17 | Fixed OpenAI JSON schema conversion to recursively normalize Gemini schema type strings such as `STRING` to JSON Schema lowercase types. | Prevents OpenAI `response_format` validation errors during OpenAI-first analysis runs. |
| 2026-05-17 | Set the shared LLM provider to prefer OpenAI `gpt-4o`, injected `OPENAI_API_KEY` into the Vite runtime config, and repaired the local OpenAI env line format. | Allows the app to run analyses with OpenAI first while preserving Gemini as the backup provider. |
| 2026-05-17 | Added OpenAI `gpt-4o` fallback in `src/agents/LLMProvider.ts` when Gemini is missing, rate-limited, or has authentication/permission failures. | Keeps the existing agent function signatures working while allowing analyses to continue when Gemini is unavailable. |
