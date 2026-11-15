"""Turns the recorded sounds in art/src/audio/ (from Higgsfield) into the small files the site plays once a visitor
turns sound on. Needs ffmpeg (with libmp3lame) and numpy (part of the bpy venv).
Usage (from rebuild/art): .venv/bin/python build_audio.py

  hum.mp3   a30, the room hum: levelled (the source swells by about 10 dB over its 20 s), cut to a 12 s loop with a
            2 s crossfade so it repeats without a seam, then padded with 50 ms of itself at each end. The site loops
            from HUM_PAD to HUM_PAD + HUM_LOOP (see src/story/sound.ts), so a decoder's few silent start-up samples
            never fall inside the loop.
  tick.mp3  a32, the clean tick at about 0.64 s, cut out, rumble removed, faded and peak-normalised.

a31 (the click) is not used: the download is near silent (peak -42 dBFS, no transient, only background noise), so
the site keeps its synthesised click for that moment.
"""
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src", "audio")
OUT = os.path.join(HERE, "..", "public", "audio")
SR = 44100
HUM_LOOP, HUM_FADE, HUM_PAD = 12.0, 2.0, 0.05  # keep HUM_LOOP and HUM_PAD in step with src/story/sound.ts


def decode(name, filters=""):
    cmd = ["ffmpeg", "-v", "error", "-i", os.path.join(SRC, name), "-ac", "1", "-ar", str(SR)]
    if filters:
        cmd += ["-af", filters]
    raw = subprocess.run(cmd + ["-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def encode(x, name, rate, kbps):
    path = os.path.join(OUT, name)
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
           "-ar", str(rate), "-c:a", "libmp3lame", "-b:a", f"{kbps}k", "-map_metadata", "-1", path]
    subprocess.run(cmd, input=x.astype(np.float32).tobytes(), check=True)
    print(f"{name}: {len(x) / SR:.2f} s, peak {20 * np.log10(np.abs(x).max()):.1f} dBFS, "
          f"rms {20 * np.log10(np.sqrt((x ** 2).mean())):.1f} dBFS, {os.path.getsize(path) / 1024:.1f} KB")


def smooth(x, seconds):
    n = max(1, int(seconds * SR))
    k = np.ones(n) / n
    return np.convolve(np.pad(x, (n // 2, n - n // 2 - 1), mode="edge"), k, mode="valid")


os.makedirs(OUT, exist_ok=True)

# ── Hum: level it, loop it ──
hum = decode("a30_hum_loop.mp3", "highpass=f=25,lowpass=f=6000")
env = np.sqrt(smooth(hum ** 2, 2.0))  # slow loudness, 2 s window
gain = smooth(0.1 / np.maximum(env, 1e-4), 1.0)  # ride the gain toward -20 dBFS rms, smoothed so it never pumps
hum = hum * gain
n, x = int(HUM_LOOP * SR), int(HUM_FADE * SR)
assert len(hum) >= n + x, "hum source is too short for the loop"
loop = hum[x:x + n].copy()
t = np.linspace(0, np.pi / 2, x)
loop[n - x:] = hum[n:n + x] * np.cos(t) + hum[:x] * np.sin(t)  # equal-power crossfade into the loop's own start
loop *= 0.1 / np.sqrt((loop ** 2).mean())
pad = int(HUM_PAD * SR)
encode(np.concatenate([loop[-pad:], loop, loop[:pad]]), "hum.mp3", 22050, 32)

# ── Tick: the clean transient at about 0.64 s ──
src = decode("a32_tick.mp3", "highpass=f=120")
a, b = int(0.5 * SR), int(0.8 * SR)
peak = a + int(np.argmax(np.abs(src[a:b])))
tick = src[peak - int(0.004 * SR):peak + int(0.16 * SR)].copy()
fade_in, fade_out = int(0.003 * SR), int(0.09 * SR)
tick[:fade_in] *= np.linspace(0, 1, fade_in)
tick[-fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out)) ** 2
tick *= 0.708 / np.abs(tick).max()  # -3 dBFS peak
print(f"tick cut at {peak / SR:.3f} s of a32")
encode(tick, "tick.mp3", 44100, 48)
