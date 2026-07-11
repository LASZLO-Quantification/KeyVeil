import math
from dataclasses import replace

import pytest

from agent_wallet import (
    HmacApprovalAuthority,
    InMemoryBudgetStore,
    PaymentIntent,
    PolicyEngine,
    SessionScope,
    evaluate_payment,
)

NOW = 1_800_000_000
RECIPIENT = "0x1111111111111111111111111111111111111111"


def make_scope(
    *,
    max_per_tx_usd: float = 50.0,
    daily_budget_usd: float = 100.0,
    paused: bool = False,
) -> SessionScope:
    return SessionScope(
        session_id="session_test",
        agent_id="agent_test",
        expires_at_epoch=NOW + 3600,
        max_per_tx_usd=max_per_tx_usd,
        daily_budget_usd=daily_budget_usd,
        allowed_recipients=frozenset({RECIPIENT}),
        allowed_tokens=frozenset({"USDC"}),
        allowed_methods=frozenset({"api_quota"}),
        paused=paused,
    )


def make_engine(*, approval_threshold: float = 20.0) -> PolicyEngine:
    return PolicyEngine.from_defaults(
        policy_version="test-policy-v1",
        per_tx_confirm_above_usd=approval_threshold,
        whitelist_recipients=frozenset({RECIPIENT}),
        allowed_tokens=frozenset({"USDC"}),
        weekly_budget_usd=250.0,
    )


def make_intent(intent_id: str, amount: float = 2.0) -> PaymentIntent:
    return PaymentIntent(
        intent_id=intent_id,
        task_id=f"task_{intent_id}",
        agent_id="agent_test",
        recipient=RECIPIENT,
        token="USDC",
        amount_usd=amount,
        reason="Synthetic test intent",
        intent_tag="api_quota",
    )


def evaluate(intent: PaymentIntent, **kwargs):
    return evaluate_payment(
        kwargs.pop("scope", make_scope()),
        kwargs.pop("engine", make_engine()),
        intent,
        budget_store=kwargs.pop("budget_store", InMemoryBudgetStore()),
        now_epoch=NOW,
        **kwargs,
    )


def test_approved_intent_reserves_budget_and_hashes_receipt():
    receipt = evaluate(make_intent("intent_approved"))

    assert receipt.status == "approved"
    assert receipt.budget_reservation_id.startswith("budget_")
    assert receipt.schema_version == "keyveil.receipt.v1"
    assert receipt.session_id == "session_test"
    assert receipt.policy_version == "test-policy-v1"
    assert receipt.ts_ms == NOW * 1000
    assert receipt.verify_hash()


@pytest.mark.parametrize("amount", [0.0, -1.0, math.nan, math.inf, -math.inf])
def test_invalid_amounts_are_rejected_at_the_model_boundary(amount):
    with pytest.raises(ValueError, match="finite positive"):
        make_intent("intent_invalid", amount)


def test_session_requires_explicit_recipient_and_token_allowlists():
    with pytest.raises(ValueError, match="allowed_recipients"):
        SessionScope(
            session_id="session",
            agent_id="agent",
            expires_at_epoch=NOW + 60,
            max_per_tx_usd=5.0,
            daily_budget_usd=10.0,
            allowed_recipients=frozenset(),
            allowed_tokens=frozenset({"USDC"}),
        )


def test_threshold_requires_verified_approval_grant():
    intent = make_intent("intent_review", 30.0)
    receipt = evaluate(intent)

    assert receipt.status == "pending_human"
    assert receipt.approval_id is None
    assert "approval_required" in receipt.policy_hits


def test_valid_hmac_approval_grant_is_bound_to_the_intent():
    intent = make_intent("intent_verified", 30.0)
    authority = HmacApprovalAuthority(bytes(range(32)))
    grant = authority.issue(intent_id=intent.intent_id, approved_by="owner", now_epoch=NOW)

    receipt = evaluate(intent, approval=grant, approval_verifier=authority)

    assert receipt.status == "approved"
    assert receipt.approval_id == grant.approval_id
    assert receipt.approved_by == "owner"
    assert "approval_verified" in receipt.policy_hits


def test_forged_approval_grant_does_not_cross_the_threshold():
    intent = make_intent("intent_forged", 30.0)
    authority = HmacApprovalAuthority(bytes(range(32)))
    grant = authority.issue(intent_id=intent.intent_id, approved_by="owner", now_epoch=NOW)
    forged = replace(grant, signature="0" * 64)

    receipt = evaluate(intent, approval=forged, approval_verifier=authority)

    assert receipt.status == "pending_human"
    assert "could not be verified" in receipt.risk_notes[-1]


def test_budget_reservation_accumulates_and_blocks_projected_spend():
    store = InMemoryBudgetStore()
    scope = make_scope(max_per_tx_usd=15.0, daily_budget_usd=20.0)
    first = evaluate(make_intent("intent_first", 12.0), scope=scope, budget_store=store)
    second = evaluate(make_intent("intent_second", 9.0), scope=scope, budget_store=store)

    assert first.status == "approved"
    assert second.status == "blocked"
    assert second.policy_hits == ("session_daily_budget",)


def test_budget_reservation_is_idempotent_per_intent_id():
    store = InMemoryBudgetStore()
    scope = make_scope(daily_budget_usd=20.0)
    intent = make_intent("intent_idempotent", 2.0)

    first = evaluate(intent, scope=scope, budget_store=store)
    repeated = evaluate(intent, scope=scope, budget_store=store)
    remainder = evaluate(make_intent("intent_remainder", 18.0), scope=scope, budget_store=store)

    assert first.budget_reservation_id == repeated.budget_reservation_id
    assert remainder.status == "approved"


def test_committed_budget_cannot_be_released():
    store = InMemoryBudgetStore()
    result = store.reserve(
        session_id="session_test",
        intent_id="intent_committed",
        amount_usd=2.0,
        daily_limit_usd=20.0,
        weekly_limit_usd=100.0,
        now_epoch=NOW,
    )
    assert result.reservation is not None
    store.commit(result.reservation.reservation_id)

    with pytest.raises(ValueError, match="committed reservations cannot be released"):
        store.release(result.reservation.reservation_id)


def test_approved_decision_fails_closed_without_budget_store():
    receipt = evaluate_payment(
        make_scope(),
        make_engine(),
        make_intent("intent_no_store"),
        budget_store=None,
        now_epoch=NOW,
    )

    assert receipt.status == "blocked"
    assert receipt.policy_hits == ("budget_store_required",)


@pytest.mark.parametrize(
    ("scope", "intent", "expected_hit"),
    [
        (make_scope(paused=True), make_intent("intent_paused"), "session_paused"),
        (
            replace(make_scope(), expires_at_epoch=NOW),
            make_intent("intent_expired"),
            "session_expired",
        ),
        (
            make_scope(),
            replace(make_intent("intent_agent"), agent_id="different-agent"),
            "agent_id_mismatch",
        ),
        (
            make_scope(),
            replace(make_intent("intent_token"), token="WETH"),
            "session_token_not_allowed",
        ),
        (
            make_scope(),
            replace(make_intent("intent_method"), intent_tag="p2p_transfer"),
            "intent_not_in_session_scope",
        ),
    ],
)
def test_session_gates_block_before_budget(scope, intent, expected_hit):
    receipt = evaluate(intent, scope=scope)

    assert receipt.status == "blocked"
    assert expected_hit in receipt.policy_hits


def test_receipt_hash_detects_mutation():
    receipt = evaluate(make_intent("intent_hash"))
    mutated = replace(receipt, amount_usd=receipt.amount_usd + 1)

    assert receipt.verify_hash()
    assert not mutated.verify_hash()
