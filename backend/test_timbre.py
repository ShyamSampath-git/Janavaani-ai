import os
from pathlib import Path

from dotenv import load_dotenv
from gnani.tts import GnaniTTSClient, AudioConfig


BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

api_key = os.getenv("GNANI_API_KEY")

if not api_key:
    raise RuntimeError("GNANI_API_KEY was not found in .env")


print("Starting Gnani Timbre test...")

client = GnaniTTSClient(api_key=api_key)

print("Checking Timbre v2.5 voices...")

voices = client.supported_voices(model="timbre-v2.5")
print(voices)

print("Generating English speech...")

audio = client.synthesize(
    "నమస్కారం, ఇది జనవాణి ఏఐ.",
    voice="Kaveri",
    model="timbre-v2.5",
    language="te-IN",
    speed=1.0,
    audio_config=AudioConfig(
        container="mp3",
        sample_rate=48000,
        bitrate="128k",
    ),
)

output_path = BASE_DIR / "timbre_test_telugu.mp3"
output_path.write_bytes(audio)

print("Telugu Timbre test completed successfully.")
print(f"Audio saved to: {output_path}")