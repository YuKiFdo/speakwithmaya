import os
import sys
import base64
import time
from google import genai

sys.stdout.reconfigure(encoding='utf-8')

env_file = os.path.join(os.path.dirname(__file__), ".env")
api_key = None
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.strip().split("=", 1)[1]
                break

if not api_key:
    api_key = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)
out_dir = r"d:\outsource\Maya Ai\maya-frontend\assets\sounds"
os.makedirs(out_dir, exist_ok=True)

MODEL = "gemini-3.8-flash-lite-tts"
VOICE = "Callirrhoe"

ITEMS = [
    # 1. Welcome Screen
    {
        "filename": "maya-welcome.wav",
        "text": "Hi! <giggle> I'm Maya, your personal AI English speaking coach! <short pause> I am SO excited to help you practice real conversations, correct your mistakes, and speak with TOTAL confidence! <cheer> Let's do this!",
        "style": "cheerful, warm, and highly enthusiastic",
    },
    # 2. Name Prompt Screen
    {
        "filename": "maya-onboarding-name.wav",
        "text": "Hi! <chuckle> I'm Maya, your personal English speaking coach. <short pause> What should I call you?",
        "style": "warm, friendly, and welcoming",
    },
    # 3. Phone Prompt Screen
    {
        "filename": "maya-onboarding-phone.wav",
        "text": "Awesome! To continue, enter your mobile number and enable your Starter Plan. <short pause> Let's get started!",
        "style": "upbeat, supportive, and cheerful",
    },
    # 4. Goals
    {
        "filename": "maya-goal-job.wav",
        "text": "A better job! <cheer> That is a FANTASTIC goal! We'll practice professional workplace English and job interviews together, so you stand out!",
        "style": "bright, confident, and encouraging",
    },
    {
        "filename": "maya-goal-abroad.wav",
        "text": "Working abroad! <gasp> What an exciting journey! I'll help you speak naturally and fluently in international environments.",
        "style": "excited, warm, and motivating",
    },
    {
        "filename": "maya-goal-confident.wav",
        "text": "Speaking with confidence changes EVERYTHING! <short pause> Don't worry at all about making mistakes--<chuckle> I'm here to support you every step of the way!",
        "style": "warm, compassionate, and deeply reassuring",
    },
    {
        "filename": "maya-goal-travel.wav",
        "text": "Traveling the world! <cheer> You're going to have SO much fun! We'll prepare you for airports, hotels, and chatting with locals easily.",
        "style": "bubbly, bright, and cheerful",
    },
    {
        "filename": "maya-goal-exams.wav",
        "text": "Preparing for exams takes focus! <short pause> We'll sharpen your speaking skills and vocabulary so you ace your test with flying colors!",
        "style": "motivational, clear, and confident",
    },
    # 5. Challenges
    {
        "filename": "maya-challenge-confidence.wav",
        "text": "Confidence comes with practice! We'll start with easy, fun conversations until speaking feels completely effortless for you.",
        "style": "compassionate, gentle, and encouraging",
    },
    {
        "filename": "maya-challenge-stuck.wav",
        "text": "Getting stuck is completely normal! <chuckle> Don't worry at all--I'll give you instant prompts and hints whenever you're looking for a word.",
        "style": "friendly, reassuring, and comforting",
    },
    {
        "filename": "maya-challenge-listening.wav",
        "text": "Understanding fast speech takes practice! <short pause> I'll speak clearly and match your exact pace every single step of the way.",
        "style": "patient, clear, and encouraging",
    },
    {
        "filename": "maya-challenge-grammar.wav",
        "text": "Grammar gets SO much easier the more you speak! <giggle> I'll gently correct your mistakes without interrupting your flow.",
        "style": "playful, lighthearted, and supportive",
    },
    {
        "filename": "maya-challenge-vocab.wav",
        "text": "Building your vocabulary is like a superpower! <cheer> You'll pick up natural, everyday words in every single conversation!",
        "style": "enthusiastic, bright, and inspiring",
    },
    # 6. Screen Entrance Question Prompts
    {
        "filename": "maya-goal-prompt.wav",
        "text": "What's your biggest goal? <short pause> Pick what matters most to you right now!",
        "style": "warm, enthusiastic, and encouraging",
    },
    {
        "filename": "maya-challenge-prompt.wav",
        "text": "What's hardest for you right now? <short pause> Pick your biggest challenge when speaking English.",
        "style": "friendly, gentle, and encouraging",
    },
]

print(f"Generating audio files using {MODEL} with voice '{VOICE}'...\n")

success_count = 0
for idx, item in enumerate(ITEMS, 1):
    filename = item["filename"]
    text = item["text"]
    style = item["style"]
    filepath = os.path.join(out_dir, filename)

    if os.path.exists(filepath) and os.path.getsize(filepath) > 100000:
        print(f"[{idx}/{len(ITEMS)}] {filename} already generated ({os.path.getsize(filepath)} bytes), skipping.")
        success_count += 1
        continue

    print(f"[{idx}/{len(ITEMS)}] Generating {filename}...")
    print(f"  Style: {style}")
    print(f"  Text: {text}")

    max_retries = 3
    t0 = time.time()
    for attempt in range(max_retries):
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
            elapsed = time.time() - t0
            print(f"  [OK] Saved {filename} in {elapsed:.2f}s ({len(audio_bytes)} bytes)\n")
            success_count += 1
            break
        except Exception as e:
            print(f"  [RETRY] Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                print(f"  [FAIL] Failed to generate {filename}\n")

    time.sleep(0.5)

print(f"Completed! {success_count}/{len(ITEMS)} files generated successfully with {MODEL} ({VOICE})!")
