#!/usr/bin/env python3
"""Encode a normalized 16-bit PCM WAV excerpt as a high-quality MP3."""

from __future__ import annotations

import argparse
import wave
from pathlib import Path

try:
    import lameenc
except ImportError as error:
    raise SystemExit(
        "lameenc is required: python3 -m pip install lameenc"
    ) from error


def encode(input_path: Path, output_path: Path, bitrate: int) -> None:
    with wave.open(str(input_path), "rb") as source:
        params = source.getparams()
        if params.comptype != "NONE" or params.sampwidth != 2:
            raise ValueError("MP3 input must be an uncompressed 16-bit PCM WAV")
        if params.nchannels not in (1, 2):
            raise ValueError("MP3 input must have one or two channels")

        encoder = lameenc.Encoder()
        encoder.set_bit_rate(bitrate)
        encoder.set_in_sample_rate(params.framerate)
        encoder.set_out_sample_rate(params.framerate)
        encoder.set_channels(params.nchannels)
        encoder.set_quality(2)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("wb") as destination:
            while True:
                raw = source.readframes(65536)
                if not raw:
                    break
                destination.write(encoder.encode(raw))
            destination.write(encoder.flush())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--bitrate",
        type=int,
        default=256,
        help="Total MP3 bitrate in kbps (default: 256)",
    )
    args = parser.parse_args()

    if args.output.exists():
        parser.error(f"output already exists: {args.output}")
    if not 128 <= args.bitrate <= 320:
        parser.error("bitrate must be between 128 and 320 kbps")

    encode(args.input, args.output, args.bitrate)


if __name__ == "__main__":
    main()
