# Contributing

## Development

```bash
python -m venv .venv
pip install -e ".[dev]"
ruff check .
pytest -q
```

## Pull requests

- Keep the core package free of mandatory third-party dependencies.
- Add tests for every policy or receipt-contract change.
- Use synthetic identifiers and data only.
- Do not add production credentials, endpoints, provider inventories, wallet data, or private-source copies.
- Update the security model when a trust boundary changes.

## Decision-contract changes

Changes to receipt fields, decision statuses, budget semantics, or approval
verification require a schema-version review and migration notes.
