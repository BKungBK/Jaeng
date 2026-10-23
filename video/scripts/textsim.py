"""Character-level similarity for Thai text (spaces, punctuation and quotes ignored)."""
import re
from difflib import SequenceMatcher

_DROP = re.compile(r"[\s\"'“”‘’.,:;!?()\[\]{}…\-–—/]+")


def norm(s: str) -> str:
    return _DROP.sub("", s).lower()


def similarity(a: str, b: str) -> float:
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b, autojunk=False).ratio()
