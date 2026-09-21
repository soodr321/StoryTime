#!/usr/bin/env python3
"""
Unit tests for the pure gating/timing logic in gen-audio.py (plan-voice.md A3). These import the
module but never call tts()/asr_words()/build_story() — no ffmpeg, no DeepInfra network call, no
Whisper model load, and nothing under public/ or library/ is touched. Safe to run any time:

    python3 scripts/test_gen_audio_gating.py
    python3 -m unittest scripts.test_gen_audio_gating   # (run from repo root)
"""
import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib.util
_spec = importlib.util.spec_from_file_location("gen_audio", Path(__file__).resolve().parent / "gen-audio.py")
ga = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ga)   # importing runs no I/O: main() only runs under `if __name__ == "__main__"`


class SentenceOffsets(unittest.TestCase):
    """A3 "Join-offset rule": a later sentence's words must be shifted by every earlier sentence's
    own duration AND the 420 ms join silence between them — never just the raw durations."""

    def test_first_sentence_starts_at_zero(self):
        self.assertEqual(ga.sentence_offsets([1000, 2000], 420)[0], 0)

    def test_second_sentence_offset_includes_the_join(self):
        offsets = ga.sentence_offsets([1000, 2000, 500], 420)
        self.assertEqual(offsets, [0, 1420, 3840])   # 1000+420, then +2000+420

    def test_matches_the_real_join_pause(self):
        offsets = ga.sentence_offsets([2200, 1800], 420)
        self.assertEqual(offsets[1], 2200 + 420)


class ResolveMagic(unittest.TestCase):
    def test_matches_punctuation_and_case(self):
        toks = "Ten minutes later he was asleep with the screwdriver still in his hand. It was a proper afternoon nap, with snoring.".split(" ")
        self.assertEqual(ga.resolve_magic(toks, "nap"), toks.index("nap,"))

    def test_skips_a_capitalised_proper_name(self):
        toks = ["Pat", "sat", "on", "a", "mat."]
        # "sat" only occurs lowercase — sanity check the resolver still finds it
        self.assertEqual(ga.resolve_magic(toks, "sat"), 1)
        # a magic word that only occurs capitalised (a name) still resolves to that occurrence,
        # but never prefers a capitalised hit over a lowercase one when both exist
        toks2 = ["Sat", "there", "and", "sat", "still."]
        self.assertEqual(ga.resolve_magic(toks2, "sat"), 3)

    def test_no_match_is_minus_one(self):
        self.assertEqual(ga.resolve_magic(["a", "b", "c"], "zzz"), -1)


class Align(unittest.TestCase):
    """align() must never crash (A3): it returns None on any mismatch instead of SystemExit."""

    def test_clean_1to1_map_returns_starts(self):
        toks = ["a", "crow", "found", "cheese."]
        words = [("a", 0), ("crow", 100), ("found", 300), ("cheese", 600)]
        self.assertEqual(ga.align(toks, words), [0, 100, 300, 600])

    def test_vendor_word_count_mismatch_returns_none_not_systemexit(self):
        toks = ["a", "crow", "found", "cheese."]
        words = [("a", 0), ("crow", 100)]   # far fewer vendor words than tokens (Kokoro-style)
        self.assertIsNone(ga.align(toks, words))

    def test_leftover_vendor_words_returns_none(self):
        toks = ["a", "crow"]
        words = [("a", 0), ("crow", 100), ("extra", 999)]
        self.assertIsNone(ga.align(toks, words))


class RealignFromHeard(unittest.TestCase):
    def test_aborts_when_whisper_hears_nothing(self):
        with self.assertRaises(ga.AbortPage):
            ga.realign_from_heard(["a", "b", "c"], None, None, 1000)

    def test_aborts_below_60_percent_anchor(self):
        toks = ["one", "two", "three", "four", "five"]
        heard = [("one", 0, 100)]   # only 1/5 matched
        with self.assertRaises(ga.AbortPage):
            ga.realign_from_heard(toks, heard, None, 2000)

    def test_never_returns_vendor_times_on_failure(self):
        # old bug: realign() used to return (tts_ms, False) when ASR failed. It must raise instead.
        toks = ["a", "b"]
        try:
            ga.realign_from_heard(toks, None, [111, 222], 1000)
            self.fail("expected AbortPage")
        except ga.AbortPage:
            pass

    def test_magic_word_must_be_asr_matched_or_abort(self):
        toks = "he sat down on the step first just for a minute".split(" ")
        # everything matches except "sat" (index 1), the magic word
        heard = [(t, i * 300, i * 300 + 150) for i, t in enumerate(toks) if t != "sat"]
        with self.assertRaises(ga.AbortPage):
            ga.realign_from_heard(toks, heard, None, 5000, magic_indices=(0, 1))

    def test_token_before_magic_word_must_also_be_asr_matched(self):
        toks = "he sat down on the step".split(" ")
        # "he" (index 0, the token before magic word "sat" at index 1) is missing from ASR
        heard = [(t, i * 300, i * 300 + 150) for i, t in enumerate(toks) if t != "he"]
        with self.assertRaises(ga.AbortPage):
            ga.realign_from_heard(toks, heard, None, 3000, magic_indices=(0, 1))

    def test_successful_anchor_with_magic_word_matched(self):
        toks = "he sat down on the step first just for a minute".split(" ")
        heard = [(t, i * 300, i * 300 + 150) for i, t in enumerate(toks)]
        ms, end = ga.realign_from_heard(toks, heard, None, 5000, magic_indices=(0, 1))
        self.assertEqual(ms[1], 300)          # "sat" measured, not guessed
        self.assertEqual(end[1], 450)         # Whisper's own w.end

    def test_every_token_gets_an_endms(self):
        toks = ["a", "b", "c"]
        heard = [("a", 0, 100), ("c", 400, 500)]   # "b" unmatched
        ms, end = ga.realign_from_heard(toks, heard, None, 1000)
        self.assertTrue(all(e is not None for e in end))
        self.assertEqual(end[1], ms[2])   # unmatched token's endMs is the next token's ms

    def test_gate_ms_lt_endms_lte_next(self):
        toks = ["a", "b", "c"]
        heard = [("a", 0, 100), ("b", 150, 200), ("c", 400, 500)]
        ms, end = ga.realign_from_heard(toks, heard, None, 1000)
        for k in range(len(toks)):
            nxt = ms[k + 1] if k + 1 < len(toks) else 1000
            self.assertLess(ms[k], end[k])
            self.assertLessEqual(end[k], nxt)

    def test_vendor_timestamp_fills_a_hole_only_when_it_agrees_with_both_anchors(self):
        toks = ["a", "b", "c", "d"]
        heard = [("a", 0, 50), ("d", 900, 950)]   # b, c unmatched
        # a plausible vendor start for "c" (inside the 0..900 bracket) is used instead of the
        # straight-line interpolation
        ms, _ = ga.realign_from_heard(toks, heard, [None, None, 600, None], 1000)
        self.assertEqual(ms[2], 600)

    def test_vendor_timestamp_outside_the_asr_bracket_is_ignored(self):
        toks = ["a", "b", "c", "d"]
        heard = [("a", 0, 50), ("d", 900, 950)]
        # a bogus vendor value (before "a" even starts) must not be trusted
        ms, _ = ga.realign_from_heard(toks, heard, [None, None, -500, None], 1000)
        self.assertGreater(ms[2], 0)

    def test_never_a_positional_zip_when_vendor_and_token_counts_disagree(self):
        # Kokoro: 21 timestamps for a 24-token page. align() already returns None for this case,
        # so realign_from_heard() must produce a sane result from ASR alone with vendor_starts=None.
        # 24 distinct words (norm() strips digits, so "w0".."w23" would collapse to the same "w" —
        # real story text, not placeholders).
        toks = ("on sunday afternoon dad said he was going to fix the gate and carried out his "
                "toolbox with a glass of cold water outside").split(" ")
        self.assertEqual(len(toks), 24)
        heard = [(t, i * 100, i * 100 + 50) for i, t in enumerate(toks) if i % 4 != 1]   # 18/24 matched (75%)
        ms, end = ga.realign_from_heard(toks, heard, None, 3000)
        self.assertEqual(len(ms), 24)
        for k in range(1, 24):
            self.assertGreater(ms[k], ms[k - 1])


class BridgeSubstitutions(unittest.TestCase):
    """
    A7d: Whisper spells `hare` "hair", `howled` "held", `dal` "doll". Dropping those words cost the
    token its real measurement AND put a synthetic time inside the measured span of the word before
    it, which failed the endMs <= next.ms gate and aborted three of the sixteen books, identically
    on every retry. One unmatched token with exactly one unclaimed heard word between its matched
    neighbours is that word.
    """

    def test_a_single_substituted_word_takes_the_heard_word_in_its_place(self):
        toks = "The hare ran fast".split(" ")
        heard = [("The", 0, 100), ("hair", 100, 380), ("ran", 380, 680), ("fast", 680, 1240)]
        self.assertEqual(ga._match_tokens(toks, heard), {0: 0, 1: 1, 2: 2, 3: 3})

    def test_it_reaches_the_first_and_last_token_too(self):
        toks = "Nani was making dal.".split(" ")
        heard = [("Nanny", 0, 240), ("was", 240, 400), ("making", 400, 840), ("doll.", 840, 1220)]
        self.assertEqual(ga._match_tokens(toks, heard), {0: 0, 1: 1, 2: 2, 3: 3})

    def test_the_bridged_token_gets_ASRs_own_times_not_an_interpolation(self):
        toks = "the other jackals howled at".split(" ")
        heard = [("the", 0, 50), ("other", 50, 350), ("jackals", 350, 950),
                 ("held", 950, 1250), ("at", 1250, 1570)]
        ms, end = ga.realign_from_heard(toks, heard, None, 2000)
        self.assertEqual((ms[3], end[3]), (950, 1250))   # interpolation would have said 800, inside `jackals`

    def test_two_unmatched_tokens_in_a_row_are_left_alone(self):
        """The correspondence is no longer forced, so the page falls back to interpolation and,
        if that is inconsistent, fails loud — exactly as it did before."""
        toks = "one two three four".split(" ")
        heard = [("one", 0, 100), ("XX", 100, 200), ("YY", 200, 300), ("four", 300, 400)]
        self.assertEqual(ga._match_tokens(toks, heard), {0: 0, 3: 3})

    def test_a_deleted_word_is_not_bridged(self):
        """Whisper heard fewer words than there are tokens: there is no candidate to pair with."""
        toks = "one two three".split(" ")
        heard = [("one", 0, 100), ("three", 100, 200)]
        self.assertNotIn(1, ga._match_tokens(toks, heard))


class SnapStartsOutOfSilence(unittest.TestCase):
    """
    A7d: Whisper stretches the word that opens a segment back to the segment boundary, and that
    boundary sits in silence — 26 of the 49 shipped pages had tokens[0].ms == 0 in a file whose
    first 580 ms are silent. That read as a 1.6-2.8x elongated opening word and was blamed on the
    synthesiser. A word cannot begin during silence.
    """

    def _with_profile(self, db_frames, heard):
        import numpy as np
        orig_db, orig_pcm = ga._rms_db, ga._pcm
        ga._rms_db = lambda *a, **k: np.array(db_frames, dtype="float64")
        ga._pcm = lambda *a, **k: np.zeros(16, dtype="float32")
        try:
            return ga._snap_starts_out_of_silence(Path("unused"), heard)
        finally:
            ga._rms_db, ga._pcm = orig_db, orig_pcm

    def test_a_start_inside_the_leading_silence_moves_to_where_sound_begins(self):
        db = [-100.0] * 58 + [0.0] * 142          # silence for 580 ms, then speech
        (_, st, en) = self._with_profile(db, [("On", 0.0, 920.0)])[0]
        self.assertEqual(st, 580.0)
        self.assertEqual(en, 920.0)

    def test_a_start_already_on_speech_does_not_move(self):
        db = [-100.0] * 58 + [0.0] * 142
        (_, st, _) = self._with_profile(db, [("crow", 900.0, 1200.0)])[0]
        self.assertEqual(st, 900.0)

    def test_a_word_whose_whole_span_is_silent_is_left_alone(self):
        """Snapping it would push the start onto its own end and manufacture a zero-width span —
        exactly the thing the ms < endMs gate exists to catch."""
        db = [-100.0] * 50 + [0.0] * 150
        (_, st, en) = self._with_profile(db, [("down", 0.0, 500.0)])[0]
        self.assertLess(st, en)
        self.assertEqual(st, 0.0)


if __name__ == "__main__":
    unittest.main()
