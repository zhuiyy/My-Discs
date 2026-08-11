#!/usr/bin/env python3
"""Balance PCM WAV excerpts for the website without third-party packages."""

from __future__ import annotations

import argparse
import audioop
import json
import math
import wave
from pathlib import Path


ABSOLUTE_GATE_DB = -70.0
RELATIVE_GATE_DB = -10.0
BLOCK_SECONDS = 0.4


def amplitude_to_db(amplitude: float, full_scale: float) -> float:
    if amplitude <= 0:
        return float("-inf")
    return 20.0 * math.log10(amplitude / full_scale)


def gated_level(path: Path) -> tuple[wave._wave_params, float, float]:
    with wave.open(str(path), "rb") as source:
        params = source.getparams()
        if params.comptype != "NONE":
            raise ValueError("Only uncompressed PCM WAV input is supported")
        if params.sampwidth not in (1, 2, 3, 4):
            raise ValueError(f"Unsupported sample width: {params.sampwidth}")

        frames_per_block = max(1, round(params.framerate * BLOCK_SECONDS))
        full_scale = float((1 << (params.sampwidth * 8 - 1)) - 1)
        block_powers = []
        peak = 0

        while True:
            raw = source.readframes(frames_per_block)
            if not raw:
                break
            rms = audioop.rms(raw, params.sampwidth)
            peak = max(peak, audioop.max(raw, params.sampwidth))
            level_db = amplitude_to_db(rms, full_scale)
            if level_db > ABSOLUTE_GATE_DB:
                block_powers.append(float(rms) ** 2)

    if not block_powers:
        raise ValueError("The input contains no audible programme above the silence gate")

    preliminary_rms = math.sqrt(sum(block_powers) / len(block_powers))
    relative_gate = amplitude_to_db(preliminary_rms, full_scale) + RELATIVE_GATE_DB
    gate_db = max(ABSOLUTE_GATE_DB, relative_gate)
    gated_powers = [
        power
        for power in block_powers
        if amplitude_to_db(math.sqrt(power), full_scale) > gate_db
    ]
    integrated_rms = math.sqrt(sum(gated_powers) / len(gated_powers))
    return params, amplitude_to_db(integrated_rms, full_scale), amplitude_to_db(peak, full_scale)


def normalize(input_path: Path, output_path: Path, target_db: float, peak_ceiling_db: float) -> dict[str, float]:
    params, input_level_db, input_peak_db = gated_level(input_path)
    desired_gain_db = target_db - input_level_db
    peak_limited_gain_db = peak_ceiling_db - input_peak_db
    applied_gain_db = min(desired_gain_db, peak_limited_gain_db)
    multiplier = 10.0 ** (applied_gain_db / 20.0)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(input_path), "rb") as source, wave.open(str(output_path), "wb") as destination:
        destination.setparams(params)
        while True:
            raw = source.readframes(65536)
            if not raw:
                break
            destination.writeframesraw(audioop.mul(raw, params.sampwidth, multiplier))

    _, output_level_db, output_peak_db = gated_level(output_path)
    return {
        "input_level_dbfs": round(input_level_db, 2),
        "input_peak_dbfs": round(input_peak_db, 2),
        "requested_target_dbfs": target_db,
        "applied_gain_db": round(applied_gain_db, 2),
        "output_level_dbfs": round(output_level_db, 2),
        "output_peak_dbfs": round(output_peak_db, 2),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--target", type=float, default=-23.5, help="Gated programme RMS target in dBFS")
    parser.add_argument("--peak-ceiling", type=float, default=-1.5, help="Maximum sample peak in dBFS")
    args = parser.parse_args()

    if args.output.exists():
        parser.error(f"output already exists: {args.output}")
    metrics = normalize(args.input, args.output, args.target, args.peak_ceiling)
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
