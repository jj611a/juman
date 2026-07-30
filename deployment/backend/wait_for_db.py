"""Wait until PostgreSQL accepts connections, then exit 0 or fail after timeout."""

from __future__ import annotations

import argparse
import asyncio
import sys
import time


async def _probe(dsn: str) -> None:
    import asyncpg

    # SQLAlchemy async URL -> asyncpg
    url = dsn.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url, timeout=5)
    await conn.close()


def wait_for_db(dsn: str, *, timeout_sec: float = 120.0, interval_sec: float = 2.0) -> None:
    deadline = time.monotonic() + timeout_sec
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            asyncio.run(_probe(dsn))
            return
        except Exception as exc:  # noqa: BLE001 — retry until timeout
            last_error = exc
            time.sleep(interval_sec)
    raise RuntimeError(f"Database not ready after {timeout_sec}s: {last_error}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Wait for PostgreSQL")
    parser.add_argument("--dsn", default="", help="postgresql+asyncpg://… or env DATABASE_URL")
    parser.add_argument("--timeout", type=float, default=120.0)
    parser.add_argument("--interval", type=float, default=2.0)
    args = parser.parse_args(argv)
    import os

    dsn = args.dsn or os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("DATABASE_URL is required", file=sys.stderr)
        return 2
    try:
        wait_for_db(dsn, timeout_sec=args.timeout, interval_sec=args.interval)
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1
    print("database ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
