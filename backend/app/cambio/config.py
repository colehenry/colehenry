"""All rule knobs in one place — rule tweaks never touch engine logic.

Defaults per context/cambio_plan.md §1.7/§11 (resolved 2026-07-21):
2 jokers, fixed bottom-two 5s opening peek, 3s snap window, caller penalty off,
one-card sudden-death ties, single-round matches.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class CambioConfig:
    num_players: int = 2
    joker_count: int = 2
    hand_size: int = 4
    opening_peek_count: int = 2
    opening_peek_ms: int = 5000
    power_reveal_ms: int = 2500
    # True: peek the fixed bottom row; False: player chooses which cards.
    opening_peek_fixed: bool = True
    snap_enabled: bool = True
    snap_window_ms: int = 3000
    # 0 disables; N adds +N to the caller's score when not strictly lowest.
    caller_penalty: int = 0
    tie_rule: str = "sudden_death"  # tied lows immediately redeal one card each
    match_mode: str = "single"  # "single" | "cumulative"
    match_threshold: int = 100

    def to_dict(self) -> dict:
        return {
            "num_players": self.num_players,
            "joker_count": self.joker_count,
            "hand_size": self.hand_size,
            "opening_peek_count": self.opening_peek_count,
            "opening_peek_ms": self.opening_peek_ms,
            "power_reveal_ms": self.power_reveal_ms,
            "opening_peek_fixed": self.opening_peek_fixed,
            "snap_enabled": self.snap_enabled,
            "snap_window_ms": self.snap_window_ms,
            "caller_penalty": self.caller_penalty,
            "tie_rule": self.tie_rule,
            "match_mode": self.match_mode,
            "match_threshold": self.match_threshold,
        }
