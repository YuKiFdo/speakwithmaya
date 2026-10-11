import os
import sys
import base64
import time
from google import genai

sys.stdout.reconfigure(encoding='utf-8')

key = os.getenv('GEMINI_API_KEY')
if not key:
    print("Please set GEMINI_API_KEY")
    sys.exit(1)
client = genai.Client(api_key=key)
out_dir = r"d:\outsource\Maya Ai\maya-frontend\assets\sounds"
os.makedirs(out_dir, exist_ok=True)

MODEL = "gemini-3.8-flash-lite-tts"
VOICE = "Callirrhoe"

ITEMS = [
    # Level selections (short & punchy)
    {
        "filename": "maya-level-beginner.wav",
        "text": "A wonderful place to start! We'll build your confidence step by step.",
        "style": "warm, gentle, and encouraging",
    },
    {
        "filename": "maya-level-intermediate.wav",
        "text": "Great foundation! <chuckle> Let's get you speaking naturally and smoothly.",
        "style": "cheerful, positive, and confident",
    },
    {
        "filename": "maya-level-upper-intermediate.wav",
        "text": "Impressive! We'll polish those tiny mistakes and elevate your fluency.",
        "style": "excited, encouraging, and bright",
    },
    {
        "filename": "maya-level-advanced.wav",
        "text": "Fantastic! <cheer> Let's fine-tune your nuance for total speaking mastery.",
        "style": "enthusiastic, inspiring, and lively",
    },

    # Employment selections (short & punchy)
    {
        "filename": "maya-employment-full-time.wav",
        "text": "Got it! We'll focus on practical workplace English you can use right away.",
        "style": "confident, supportive, and professional",
    },
    {
        "filename": "maya-employment-part-time.wav",
        "text": "Awesome! <chuckle> Flexible practice tailored right around your schedule.",
        "style": "cheerful, bright, and supportive",
    },
    {
        "filename": "maya-employment-student.wav",
        "text": "Exciting! We'll help you speak up in class and ace your presentations.",
        "style": "encouraging, friendly, and lively",
    },
    {
        "filename": "maya-employment-looking-for-job.wav",
        "text": "You've got this! <cheer> We'll practice winning interview answers together.",
        "style": "motivational, warm, and highly confident",
    },
    {
        "filename": "maya-employment-other.wav",
        "text": "Perfect! We'll tailor everyday, natural conversations just for you.",
        "style": "warm, friendly, and welcoming",
    },

    # Daily goal selections (short & punchy)
    {
        "filename": "maya-daily-goal-5min.wav",
        "text": "Five minutes every day builds an unbreakable speaking habit!",
        "style": "cheerful, bright, and motivating",
    },
    {
        "filename": "maya-daily-goal-10min.wav",
        "text": "Ten minutes a day is the sweet spot for fast, steady progress! <cheer>",
        "style": "excited, confident, and highly encouraging",
    },
    {
        "filename": "maya-daily-goal-15min.wav",
        "text": "Fifteen minutes a day! You're going to see amazing results quickly!",
        "style": "enthusiastic, vibrant, and energetic",
    },
    {
        "filename": "maya-daily-goal-30min.wav",
        "text": "Thirty minutes a day! <gasp> That dedication will take you to fluency in no time!",
        "style": "thrilled, amazed, and deeply motivational",
    },
]

print(f"Generating {len(ITEMS)} short selection feedback voices using {MODEL} with '{VOICE}'...\n")

for idx, item in enumerate(ITEMS, 1):
    filename = item["filename"]
    text = item["text"]
    style = item["style"]
    filepath = os.path.join(out_dir, filename)

    print(f"[{idx}/{len(ITEMS)}] Generating {filename}...")
    t0 = time.time()
    try:
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
        dt = time.time() - t0
        print(f"  [OK] Saved {filename} in {dt:.2f}s ({len(audio_bytes)} bytes)\n")
    except Exception as e:
        print(f"  [ERROR] Failed {filename}: {e}\n")
    time.sleep(0.4)

print("All short selection feedback voices generated!")
