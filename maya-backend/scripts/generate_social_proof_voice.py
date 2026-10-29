import os
import sys
import base64
import time
from google import genai

sys.stdout.reconfigure(encoding='utf-8')

env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
api_key = None
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        lines = [line.strip() for line in f]
        for line in lines:
            if line.startswith("GEMINI_TTS_API_KEY=") and line.split("=", 1)[1].strip():
                api_key = line.split("=", 1)[1].strip()
                break
        if not api_key:
            for line in lines:
                if line.startswith("GEMINI_API_KEY=") and line.split("=", 1)[1].strip():
                    api_key = line.split("=", 1)[1].strip()
                    break

if not api_key:
    api_key = os.environ.get("GEMINI_TTS_API_KEY") or os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
    sys.exit(1)

client = genai.Client(api_key=api_key)
out_dir = r"d:\outsource\Maya Ai\maya-frontend\assets\sounds"
os.makedirs(out_dir, exist_ok=True)

MODEL = "gemini-3.8-flash-lite-tts"
VOICE = "Callirrhoe"

filename = "maya-social-proof-prompt.wav"
text = "See your progress in just two weeks! <short pause> The more you practice, the more confident you'll become! <chuckle> Over ten thousand people already use Maya to speak English!"
style = "bright, cheerful, warm, and highly encouraging"
filepath = os.path.join(out_dir, filename)

print(f"Generating {filename} with Gemini TTS ({MODEL}, voice: {VOICE})...")
print(f"Text: {text}")

interaction = client.interactions.create(
    model=MODEL,
    input=[{
        "type": "user_input",
        "content": [{
            "type": "text",
            "text": text,
            "annotations": [{
                "type": "speech_metadata",
                "style": style,
            }],
        }],
    }],
    response_format={"type": "audio"},
    generation_config={
        "speech_config": [
            {"voice": VOICE},
        ]
    },
)

audio_bytes = base64.b64decode(interaction.output_audio.data)
with open(filepath, "wb") as f:
    f.write(audio_bytes)

print(f"[OK] Successfully saved {filename} ({len(audio_bytes)} bytes) using Gemini TTS!")
