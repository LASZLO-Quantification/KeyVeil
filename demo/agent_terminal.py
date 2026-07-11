from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = "http://127.0.0.1:8765"


def post_simulate(base: str, scenario: str) -> tuple[bool, dict[str, object]]:
    url = f"{base.rstrip('/')}/api/simulate"
    request = urllib.request.Request(
        url,
        data=json.dumps({"scenario": scenario}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return True, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        return False, {"error": raw}
    except urllib.error.URLError as error:
        return False, {"error": str(error.reason)}


def fetch_scenarios(base: str) -> list[dict[str, object]]:
    with urllib.request.urlopen(f"{base.rstrip('/')}/api/scenarios", timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("scenarios", [])


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a synthetic KeyVeil policy scenario")
    parser.add_argument("scenario", nargs="?", help="Scenario id, for example approve_small")
    parser.add_argument("--list", action="store_true", help="List available scenarios")
    parser.add_argument(
        "--base",
        default=DEFAULT_BASE,
        help=f"Reference server URL ({DEFAULT_BASE})",
    )
    args = parser.parse_args()

    if args.list:
        try:
            for scenario in fetch_scenarios(args.base):
                print(f"{scenario['id']}\t{scenario['expected_status']}\t{scenario['title']}")
        except urllib.error.URLError as error:
            print(f"Unable to connect to {args.base}: {error.reason}", file=sys.stderr)
            raise SystemExit(1) from error
        return

    if not args.scenario:
        parser.print_help()
        raise SystemExit(1)

    ok, payload = post_simulate(args.base, args.scenario)
    if not ok:
        print(payload.get("error", "request failed"), file=sys.stderr)
        raise SystemExit(1)

    for line in payload.get("trace", []):
        print(f"[trace] {line}")
    receipt = payload.get("receipt", {})
    print(
        f"[decision] status={receipt.get('status')} "
        f"hits={receipt.get('policy_hits')} hash={receipt.get('receipt_hash')}"
    )


if __name__ == "__main__":
    main()
