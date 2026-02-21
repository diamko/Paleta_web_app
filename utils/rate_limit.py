import time
from collections import defaultdict, deque
from threading import Lock

from flask import request


class InMemoryRateLimiter:
    """Простой in-memory rate limiter (sliding window)."""

    def __init__(self):
        self._events = defaultdict(deque)
        self._lock = Lock()

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> bool:
        if limit <= 0 or window_seconds <= 0:
            return False

        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= limit:
                return False

            events.append(now)
            return True


def get_client_identifier() -> str:
    """Возвращает IP клиента с учетом X-Forwarded-For."""
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        first_ip = forwarded_for.split(",", 1)[0].strip()
        if first_ip:
            return first_ip
    return request.remote_addr or "unknown"
