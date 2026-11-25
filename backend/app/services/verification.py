"""Evidence grounding: prove that a quote the LLM gave us really exists in the
transcript. Pure stdlib so it is easy to test. Anything that fails here is
dropped by the caller; we never show an unverifiable quote as evidence."""
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

FUZZY_THRESHOLD = 0.85   # word-level similarity needed for a near-match
MIN_WORDS_FOR_SEARCH = 3  # 1-2 word quotes are only trusted in the line the LLM cited


def normalize(text: str) -> str:
    """Lowercase, drop punctuation/apostrophes, collapse whitespace.
    Makes matching robust to the punctuation/casing differences LLMs introduce."""
    t = unicodedata.normalize("NFC", text or "").lower()
    t = t.replace("\u2019", "").replace("\u2018", "").replace("'", "")
    # Keep letters, digits and combining marks (Devanagari/Kannada vowel signs and
    # viramas are marks, which \w would wrongly treat as separators). Everything
    # else, including the danda "\u0964", becomes a space.
    t = "".join(c if (c.isalnum() or unicodedata.category(c).startswith("M")) else " " for c in t)
    return re.sub(r"\s+", " ", t).strip()


def _contains(haystack_norm: str, needle_norm: str) -> bool:
    # pad with spaces so "no" doesn't match inside "know"
    return f" {needle_norm} " in f" {haystack_norm} "


def _window_score(q_words: list[str], u_words: list[str]) -> float:
    n = len(q_words)
    if not u_words:
        return 0.0
    best = 0.0
    for size in {max(1, n - 1), n, n + 1}:
        if size >= len(u_words):
            best = max(best, SequenceMatcher(None, q_words, u_words).ratio())
            continue
        for start in range(len(u_words) - size + 1):
            best = max(best, SequenceMatcher(None, q_words, u_words[start:start + size]).ratio())
    return best


@dataclass(frozen=True)
class Match:
    verified: bool
    utterance_idx: int | None
    method: str   # exact | relocated | fuzzy | empty | not_found
    score: float


def verify_quote(
    quote: str,
    utterances: dict[int, str],
    claimed_idx: int | None,
    fuzzy_threshold: float = FUZZY_THRESHOLD,
) -> Match:
    """utterances maps idx -> raw utterance text."""
    nq = normalize(quote)
    q_words = nq.split()
    if not q_words:
        return Match(False, None, "empty", 0.0)

    norm = {i: normalize(t) for i, t in utterances.items()}

    # 1. exact (modulo case/punctuation) inside the line the LLM cited
    if claimed_idx in norm and _contains(norm[claimed_idx], nq):
        return Match(True, claimed_idx, "exact", 1.0)

    if len(q_words) < MIN_WORDS_FOR_SEARCH:
        return Match(False, None, "not_found", 0.0)

    # 2. exact in a different line (LLM got the line number wrong)
    hits = [i for i, nu in norm.items() if _contains(nu, nq)]
    if hits:
        pick = min(hits, key=lambda i: abs(i - claimed_idx)) if claimed_idx is not None else hits[0]
        return Match(True, pick, "relocated", 1.0)

    # 3. near-match: restrict to the cited line +/-2 when we have one
    if claimed_idx is not None:
        pool = [i for i in range(claimed_idx - 2, claimed_idx + 3) if i in norm]
    else:
        pool = list(norm)
    best_idx, best = None, 0.0
    for i in pool:
        score = _window_score(q_words, norm[i].split())
        if score > best:
            best_idx, best = i, score
    if best_idx is not None and best >= fuzzy_threshold:
        return Match(True, best_idx, "fuzzy", round(best, 3))
    return Match(False, None, "not_found", round(best, 3))
