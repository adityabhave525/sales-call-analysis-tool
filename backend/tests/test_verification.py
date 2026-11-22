from app.services.verification import normalize, verify_quote

UTTS = {
    0: "Hi, thanks for calling Acme. How can I help?",
    1: "I'm calling because my invoice is wrong and nobody has fixed it.",
    2: "Look, I already told you that's not my department. You'll have to wait.",
    3: "I'll send you the corrected invoice by Friday.",
    4: "No.",
}


def test_normalize_ignores_case_punct_and_curly_apostrophes():
    assert normalize("That\u2019s NOT my department!") == "thats not my department"


def test_exact_quote_in_cited_line():
    m = verify_quote("that's not my department", UTTS, 2)
    assert m.verified and m.method == "exact" and m.utterance_idx == 2


def test_punctuation_differences_still_verify():
    m = verify_quote("Look I already told you thats not my department", UTTS, 2)
    assert m.verified and m.method == "exact"


def test_wrong_line_number_is_relocated():
    m = verify_quote("You'll have to wait", UTTS, 1)
    assert m.verified and m.method == "relocated" and m.utterance_idx == 2


def test_fabricated_quote_is_rejected():
    m = verify_quote("Stop wasting my time and hang up", UTTS, 2)
    assert not m.verified


def test_near_match_with_one_dropped_word_accepted_as_fuzzy():
    m = verify_quote("I already told you not my department", UTTS, 2)
    assert m.verified and m.method == "fuzzy"


def test_loose_paraphrase_is_rejected():
    # rewording more than a word or so is a paraphrase, not a quote
    m = verify_quote("I already told you that is not my department", UTTS, 2)
    assert not m.verified


def test_word_boundary_is_respected():
    # "no" must not match inside "nobody" when cited line is wrong
    m = verify_quote("no", UTTS, 1)
    assert not m.verified


def test_short_quote_ok_in_cited_line_but_not_searched_elsewhere():
    assert verify_quote("No.", UTTS, 4).verified
    assert not verify_quote("No.", UTTS, 0).verified


def test_empty_quote():
    assert not verify_quote("   ", UTTS, 0).verified


def test_missing_index_searches_everywhere():
    m = verify_quote("corrected invoice by Friday", UTTS, None)
    assert m.verified and m.utterance_idx == 3
