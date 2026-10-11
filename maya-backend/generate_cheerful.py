import os
import time
import soundfile as sf
import numpy as np
from kokoro_onnx import Kokoro

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "kokoro-v1.0.int8.onnx")
VOICES_PATH = os.path.join(MODELS_DIR, "voices-v1.0.bin")

out_dir = r"d:\outsource\Maya Ai\maya-frontend\assets\sounds"
os.makedirs(out_dir, exist_ok=True)

kokoro = Kokoro(MODEL_PATH, VOICES_PATH)

# Cheerful, welcoming phrasing with upbeat intonation
text_cheerful = "Hi! I'm Maya! Your AI English speaking coach. I'm so excited to help you practice real conversations, correct your mistakes, and speak with total confidence! Let's get started!"

# Test 1: af_heart at upbeat speed (1.10) with cheerful text
print("1. Generating af_heart (upbeat 1.10x)...")
samples1, sr1 = kokoro.create(text_cheerful, voice="af_heart", speed=1.10, lang="en-us")
sf.write(os.path.join(out_dir, "maya-cheerful-heart-1.1x.wav"), samples1, sr1)
print("  Saved: maya-cheerful-heart-1.1x.wav")

# Test 2: af_sky (brightest, most enthusiastic female voice in Kokoro)
print("2. Generating af_sky (bright & enthusiastic)...")
samples2, sr2 = kokoro.create(text_cheerful, voice="af_sky", speed=1.06, lang="en-us")
sf.write(os.path.join(out_dir, "maya-cheerful-sky.wav"), samples2, sr2)
print("  Saved: maya-cheerful-sky.wav")

# Test 3: Blend of af_heart (65%) + af_sky (35%) -> Heart's warmth + Sky's cheerful energy!
print("3. Generating af_heart + af_sky blend...")
style_heart = kokoro.get_voice_style("af_heart")
style_sky = kokoro.get_voice_style("af_sky")
blend_style = (0.65 * style_heart) + (0.35 * style_sky)

samples3, sr3 = kokoro.create(text_cheerful, voice=blend_style, speed=1.08, lang="en-us")
sf.write(os.path.join(out_dir, "maya-cheerful-blend-heart-sky.wav"), samples3, sr3)
print("  Saved: maya-cheerful-blend-heart-sky.wav")

# Test 4: af_nova (crisp, modern, lively)
print("4. Generating af_nova (modern & lively)...")
samples4, sr4 = kokoro.create(text_cheerful, voice="af_nova", speed=1.08, lang="en-us")
sf.write(os.path.join(out_dir, "maya-cheerful-nova.wav"), samples4, sr4)
print("  Saved: maya-cheerful-nova.wav")

# Test 5: Original text with af_heart + af_sky blend
text_original = "Hi! I'm Maya, your AI English speaking coach! Maya helps you practice real conversations, correct your mistakes, and speak with confidence!"
samples5, sr5 = kokoro.create(text_original, voice=blend_style, speed=1.08, lang="en-us")
sf.write(os.path.join(out_dir, "maya-cheerful-heart-orig-blend.wav"), samples5, sr5)
print("  Saved: maya-cheerful-heart-orig-blend.wav")

print("All cheerful variations generated successfully!")
