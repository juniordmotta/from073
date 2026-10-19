# Architecture rules

- Store each arbitrage's amounts in its immutable native currency; use the shared pure currency module and a single current-rate snapshot for reporting, because unlike currencies must never be summed directly.
- Keep legacy BRL balances in their existing columns and foreign balances in separate currency columns; new currency-ledger bets use atomic database triggers, because legacy clients must not double-debit and balances must remain isolated.

- Keep the arbitrage assistant in its dedicated Edge Function with request-scoped AI Gateway clients, because prompts and credentials must never reach the browser.
- Read financial data through the caller's authenticated client and existing RLS; reserve the privileged client for persistent provider-denial state, because tools must not widen permissions.
- Persist one canonical UI-message conversation per user and compare database revisions on save, because concurrent tabs must not overwrite history.
- Keep metric aggregation in a pure module with colocated Deno tests, because timezone, financial and access rules need independent verification.
