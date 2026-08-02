"""Cambio card game.

Pure engine + config (engine.py, config.py), bot policy (bot.py), belief
tracking for the odds overlay (belief.py), and in-memory realtime rooms
(rooms.py). The engine has no FastAPI/DB imports — the WS router, the bot,
the belief model, and scripts/cambio_sim.py all consume the same module.
"""
