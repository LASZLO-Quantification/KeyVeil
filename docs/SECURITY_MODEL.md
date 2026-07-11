# Security Model

## Protected properties

- An agent cannot expand its session recipient, token, method, amount, or time scope.
- Non-finite, zero, and negative monetary values fail before policy evaluation.
- Human approval is not a caller-provided boolean.
- Repeating an intent id does not reserve budget twice.
- A decision fails closed when no budget store is available.
- Receipt mutations are detectable by recomputing the canonical hash.

## Explicit non-goals

This repository does not provide:

- private-key custody or wallet recovery;
- transaction construction, signing, nonce management, or broadcasting;
- exchange, broker, RPC, or blockchain integrations;
- price oracles and fiat conversion guarantees;
- durable distributed budget storage;
- KYC, sanctions, travel-rule, or jurisdictional compliance;
- cryptographic non-repudiation of receipts.

SHA-256 receipt hashes provide tamper detection only. They are not signatures.
Persist the hash in an independently controlled system when stronger audit
evidence is required.

## Production replacements

| Reference component | Production expectation |
|---|---|
| `InMemoryBudgetStore` | Transactional durable store with idempotency and recovery. |
| `HmacApprovalAuthority` | Isolated approval service, HSM-backed signing, or equivalent control plane. |
| Synthetic FastAPI demo | Authenticated, tenant-isolated API with rate and payload controls. |
| Local receipt JSON | Append-only storage, retention policy, independent timestamping, and access control. |

## Threats covered by tests

- Negative, zero, infinite, and NaN amounts.
- Empty session allowlists.
- Forged and mismatched approval grants.
- Session expiry, pause, agent mismatch, token, recipient, and method violations.
- Daily budget exhaustion and repeated intent ids.
- Receipt field mutation.
