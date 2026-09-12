# payment-sandbox review

Reviewed: uncommitted working-tree change on `feat/ecommerce-scenario-routing`.
Gate reported PASS (`npm.cmd run gate`); not re-run here.

## 1. Spec compliance — all 7 AC met

| AC | Result | Evidence |
|---|---|---|
| 1 charge no longer mock:// | met | `payment.ts:60-68` returns `sandboxPayUrl`; test `domain.test.ts:168-180` |
| 2 sole entry + HMAC first | met | `sandbox-channel.ts:71-86` verify-then-mutate; `SIGN_INVALID` at `:57,:66` |
| 3 settle mints/signs/delivers; FAILED no deduct | met | `sandbox-channel.ts:92-138`; FAILED → `paymentFail` only; test `:258-271` |
| 4 idempotent channelTxId; amount after sign | met | `payment.ts:85-91` + `payment_tx.channel_tx_id UNIQUE` (`schema.sql:143`); amount at `payment.ts:82-84` |
| 5 tools | met | `tools/index.ts:347-362` settle; `:364-389` signed callback |
| 6 docs | met (gaps) | SCENARIO, callback.md, contracts, spec updated; charge.md / PROGRESS / DECISIONS lag |
| 7 tests (5 paths) | met | `domain.test.ts:167-271` |

## 2. Correctness — no critical bugs

- Verify-before-mutate, timingSafeEqual length guard, amount-after-sign all correct.
- **Non-critical**: SUCCESS after FAILED allowed (`paymentCallbackSuccess` does not reject `failed` status) — may be intentional retry, but undocumented.
- **Non-critical**: FAILED path does not write `payment_tx` (no audit / channelTxId idempotency on fail).
- **Non-critical**: concurrent duplicate `channelTxId` INSERT can surface raw SQLite UNIQUE error instead of idempotent return (in-process SQLite, low risk).
- **Non-critical**: `paymentFail` does not check payment existence (silent no-op on unknown id).
- **Non-critical**: no timestamp freshness check (replay mitigated by channelTxId).

## 3. Codebase consistency — non-critical drift

- New `sandbox-channel.ts` matches domain/ layout, naming, DomainError style.
- **Non-critical**: `paymentCallbackSuccess` still public export while docs call it internal-only.
- **Non-critical**: `PROGRESS.md` / `DECISIONS.md` / spec task checkboxes not updated (AGENTS handoff).
- **Non-critical**: `charge.md` lacks sandboxPayUrl; `MODULE.md` still says charge 「后续补」.
- **Non-critical**: `callback.md` lists `ALREADY_PROCESSED` which code never throws.

## Verdict

**Approve with non-critical follow-ups.** Acceptance criteria satisfied; no critical correctness defects for in-process sandbox scope.
