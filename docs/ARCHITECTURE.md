# Reference Architecture

KeyVeil separates a policy decision from payment execution. The public
reference contains no production executor, provider configuration, wallet
material, or transaction data.

## Components

| Component | Responsibility |
|---|---|
| `PaymentIntent` | Validated request with stable intent and task identifiers. |
| `SessionScope` | Expiry, agent binding, per-transaction limit, daily budget, and explicit allowlists. |
| `PolicyEngine` | Immutable organization rules and the approval threshold. |
| `ApprovalVerifier` | Independently verifies an intent-bound approval grant. |
| `BudgetStore` | Atomically reserves, commits, or releases budget by intent id. |
| `PaymentReceipt` | Records the decision context and a canonical SHA-256 hash. |

## Authorization sequence

1. Constructing an intent rejects empty identifiers and non-finite or non-positive amounts.
2. The session rejects paused, expired, mismatched-agent, recipient, token, and method violations.
3. Organization policy applies additional recipient, token, transaction, and pause gates.
4. Amounts at or above the confirmation threshold require a verified approval grant.
5. Approved decisions reserve daily and weekly budget atomically.
6. A versioned receipt records the decision and reservation context.

## Reservation lifecycle

`evaluate_payment` reserves budget but does not execute a payment.

```text
reserved -> committed   external execution succeeded
reserved -> released    external execution failed permanently
```

The reference `InMemoryBudgetStore` is thread-safe and intent-idempotent, but
it is process-local. Production adapters should implement `BudgetStore` using
a transactional database and a uniqueness constraint on `(session_id,
intent_id)`.

## Trust boundaries

- Agent input is untrusted.
- Session issuance is trusted and external to this repository.
- Approval issuance is trusted and separate from the intent payload.
- Budget persistence is trusted and must be atomic.
- Execution and signing are external and must never infer success from an approved decision alone.
