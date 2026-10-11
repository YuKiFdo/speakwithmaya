import os
import sys
import urllib.request
import time
import soundfile as sf
from kokoro_onnx import Kokoro

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

MODEL_PATH = os.path.join(MODELS_DIR, "kokoro-v1.0.int8.onnx")
VOICES_PATH = os.path.join(MODELS_DIR, "voices-v1.0.bin")

def download_if_missing(url, dest_path):
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
        print(f"Already exists: {dest_path} ({os.path.getsize(dest_path)} bytes)")
        return
    print(f"Downloading {url} -> {dest_path}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(dest_path, "wb") as f:
        total_size = int(resp.headers.get("content-length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                percent = downloaded / total_size * 100
                print(f"  {downloaded / 1024 / 1024:.1f} MB / {total_size / 1024 / 1024:.1f} MB ({percent:.1f}%)", end="\r", flush=True)
    print(f"\nDownloaded: {dest_path}")

def main():
    download_if_missing(MODEL_URL, MODEL_PATH)
    download_if_missing(VOICES_URL, VOICES_PATH)

    print("Initializing Kokoro TTS...")
    kokoro = Kokoro(MODEL_PATH, VOICES_PATH)

    text = "Hi! I'm Maya, your AI English speaking coach. Maya helps you practice real conversations, correct your mistakes, and speak with confidence!"
    
    # Try af_bella and af_sarah
    out_dir = r"d:\outsource\Maya Ai\maya-frontend\assets\sounds"
    os.makedirs(out_dir, exist_ok=True)

    voices = ["af_bella", "af_sarah", "af_heart"]
    for voice in voices:
        print(f"\nGenerating speech with voice '{voice}'...")
        start_t = time.time()
        try:
            samples, sample_rate = kokoro.create(
                text,
                voice=voice,
                speed=1.0,
                lang="en-us"
            )
            elapsed = time.time() - start_t
            duration_sec = len(samples) / sample_rate
            out_file = os.path.join(out_dir, f"maya-welcome-kokoro-{voice}.wav")
            sf.write(out_file, samples, sample_rate)
            file_size = os.path.getsize(out_file)
            print(f"SUCCESS: Generated {out_file}")
            print(f"  Audio Duration: {duration_sec:.2f}s | Synthesis Time: {elapsed:.2f}s | Size: {file_size} bytes")
            
            # Also copy the best one (af_bella or first) as maya-welcome-kokoro.wav
            if voice == "af_bella":
                default_file = os.path.join(out_dir, "maya-welcome-kokoro.wav")
                sf.write(default_file, samples, sample_rate)
                print(f"  Default sample saved to: {default_file}")
        except Exception as e:
            print(f"Error with voice {voice}: {e}")

if __name__ == "__main__":
    main()
