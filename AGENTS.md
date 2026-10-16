# Architecture rules

- Keep the arbitrage assistant in its dedicated Edge Function with request-scoped AI Gateway clients, because prompts and credentials must never reach the browser.
- Read financial data through the caller's authenticated client and existing RLS; reserve the privileged client for persistent provider-denial state, because tools must not widen permissions.
- Persist one canonical UI-message conversation per user and compare database revisions on save, because concurrent tabs must not overwrite history.
- Keep metric aggregation in a pure module with colocated Deno tests, because timezone, financial and access rules need independent verification.
