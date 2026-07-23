from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
from pathlib import Path
import os
import re
import uuid
import json
import time
import tempfile
import mimetypes
import threading
import urllib.request
import urllib.parse
import hmac
import hashlib

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
except Exception:
    canvas = None

try:
    from google import genai
except Exception:
    genai = None

try:
    from google.genai import types
except Exception:
    types = None

try:
    import razorpay
except Exception:
    razorpay = None


app = FastAPI(
    title="VidGen AI Backend",
    description="Multimodal AI backend for VidGen AI video study pack generation.",
    version="3.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://vidgen-ai.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateStudyPackRequest(BaseModel):
    video_url: str
    topic: Optional[str] = "Uploaded Lecture"
    account_type: Optional[str] = "student"
    plan: Optional[str] = "free"
    client_id: Optional[str] = "anonymous"


class TutorRequest(BaseModel):
    question: str
    topic: Optional[str] = "Lecture Topic"
    notes: Optional[List[str]] = []


class ExportPDFRequest(BaseModel):
    title: str
    summary: str
    notes: List[str]
    exam_focus: List[str]
    questions: List[str]


class CreatePaymentOrderRequest(BaseModel):
    plan: str
    client_id: Optional[str] = "anonymous"


class VerifyPaymentRequest(BaseModel):
    plan: str
    client_id: Optional[str] = "anonymous"
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


USAGE_STORE_FILE = str(BASE_DIR / "usage_store.json")
PAYMENT_STORE_FILE = str(BASE_DIR / "payment_store.json")

usage_lock = threading.Lock()
payment_lock = threading.Lock()

SUPPORTED_VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/mov",
    "video/avi",
    "video/x-msvideo",
    "video/x-flv",
    "video/mpg",
    "video/webm",
    "video/x-ms-wmv",
    "video/3gpp",
}

MAX_UPLOAD_BYTES = 200 * 1024 * 1024

PLAN_PAYMENT_DETAILS = {
    "Go": {
        "amount": 100,
        "display_amount": "₹1",
        "hours": 10,
    },
    "Pro": {
        "amount": 200,
        "display_amount": "₹2",
        "hours": 16,
    },
}


def clean_video_id(video_id: str) -> Optional[str]:
    if not video_id:
        return None

    video_id = video_id.strip()
    video_id = video_id.split("?")[0]
    video_id = video_id.split("&")[0]
    video_id = video_id.split("/")[0]

    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", video_id):
        return video_id

    return None


def extract_youtube_video_id(url: str) -> Optional[str]:
    if not url:
        return None

    raw_url = url.strip()

    if not raw_url:
        return None

    if "youtube.com" not in raw_url and "youtu.be" not in raw_url:
        return None

    if not raw_url.startswith(("http://", "https://")):
        raw_url = "https://" + raw_url

    try:
        parsed_url = urlparse(raw_url)
        host = parsed_url.netloc.lower().replace("www.", "")
        path_parts = [part for part in parsed_url.path.split("/") if part]
        query_params = parse_qs(parsed_url.query)

        if host in ["youtube.com", "m.youtube.com", "music.youtube.com"]:
            if "v" in query_params:
                return clean_video_id(query_params["v"][0])

            if path_parts:
                first_part = path_parts[0]

                if first_part in ["shorts", "embed", "live", "v"] and len(path_parts) >= 2:
                    return clean_video_id(path_parts[1])

        if host == "youtu.be":
            if path_parts:
                return clean_video_id(path_parts[0])

    except Exception:
        return None

    fallback_patterns = [
        r"(?:v=)([a-zA-Z0-9_-]{11})",
        r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:shorts/)([a-zA-Z0-9_-]{11})",
        r"(?:embed/)([a-zA-Z0-9_-]{11})",
        r"(?:live/)([a-zA-Z0-9_-]{11})",
    ]

    for pattern in fallback_patterns:
        match = re.search(pattern, raw_url)
        if match:
            return clean_video_id(match.group(1))

    return None


def get_canonical_youtube_url(video_url: str) -> tuple[str, str]:
    video_id = extract_youtube_video_id(video_url)

    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please paste a valid public YouTube video, live, shorts, embed, or youtu.be link.",
        )

    canonical_url = f"https://www.youtube.com/watch?v={video_id}"
    return video_id, canonical_url


def get_today_key():
    return datetime.now().strftime("%Y-%m-%d")


def normalize_plan(plan: str) -> str:
    clean_plan = str(plan or "Free").strip().lower()

    if clean_plan == "go":
        return "Go"

    if clean_plan == "pro":
        return "Pro"

    return "Free"


def get_plan_limit_hours(plan: str) -> float:
    clean_plan = normalize_plan(plan)

    if clean_plan == "Go":
        return 10.0

    if clean_plan == "Pro":
        return 16.0

    return 4.0


def safe_client_id(client_id: str) -> str:
    clean_id = str(client_id or "anonymous").strip()
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", clean_id)

    return clean_id[:80] or "anonymous"


def load_usage_store():
    if not os.path.exists(USAGE_STORE_FILE):
        return {}

    try:
        with open(USAGE_STORE_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return {}


def save_usage_store(data):
    with open(USAGE_STORE_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def get_usage_status_data(client_id: str, plan: str):
    today = get_today_key()
    safe_id = safe_client_id(client_id)
    clean_plan = normalize_plan(plan)
    limit_hours = get_plan_limit_hours(clean_plan)

    with usage_lock:
        store = load_usage_store()
        user_data = store.get(safe_id, {})

        if user_data.get("date") != today:
            user_data = {
                "date": today,
                "used_hours": 0.0,
                "history": [],
            }
            store[safe_id] = user_data
            save_usage_store(store)

        used_hours = float(user_data.get("used_hours", 0.0))
        remaining_hours = max(limit_hours - used_hours, 0.0)

        return {
            "client_id": safe_id,
            "plan": clean_plan,
            "date": today,
            "limit_hours": round(limit_hours, 3),
            "used_hours": round(used_hours, 3),
            "remaining_hours": round(remaining_hours, 3),
        }


def check_usage_limit_or_raise(client_id: str, plan: str, requested_hours: float):
    requested = max(float(requested_hours or 0), 1 / 60)
    status = get_usage_status_data(client_id, plan)

    if requested > status["remaining_hours"]:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily limit reached. Your {status['plan']} plan has "
                f"{status['limit_hours']} hrs/day. Remaining today: "
                f"{status['remaining_hours']} hrs. This video needs "
                f"{round(requested, 2)} hrs."
            ),
        )

    return status


def record_usage_hours(client_id: str, plan: str, charged_hours: float, source: str):
    today = get_today_key()
    safe_id = safe_client_id(client_id)
    clean_plan = normalize_plan(plan)
    charged = max(float(charged_hours or 0), 1 / 60)

    with usage_lock:
        store = load_usage_store()
        user_data = store.get(safe_id, {})

        if user_data.get("date") != today:
            user_data = {
                "date": today,
                "used_hours": 0.0,
                "history": [],
            }

        current_used = float(user_data.get("used_hours", 0.0))
        updated_used = current_used + charged

        user_data["used_hours"] = updated_used
        user_data.setdefault("history", []).append(
            {
                "source": source,
                "charged_hours": round(charged, 3),
                "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
        )

        store[safe_id] = user_data
        save_usage_store(store)

    return get_usage_status_data(safe_id, clean_plan)


def load_payment_store():
    if not os.path.exists(PAYMENT_STORE_FILE):
        return {
            "orders": {},
            "plans": {},
        }

    try:
        with open(PAYMENT_STORE_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        data.setdefault("orders", {})
        data.setdefault("plans", {})

        return data
    except Exception:
        return {
            "orders": {},
            "plans": {},
        }


def save_payment_store(data):
    with open(PAYMENT_STORE_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def get_razorpay_client():
    if razorpay is None:
        raise HTTPException(
            status_code=500,
            detail="Razorpay package is not installed. Run: python -m pip install razorpay",
        )

    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Razorpay keys are missing on backend.",
        )

    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def get_saved_plan_for_client(client_id: str) -> str:
    safe_id = safe_client_id(client_id)

    with payment_lock:
        store = load_payment_store()
        plan_data = store.get("plans", {}).get(safe_id, {})

    saved_plan = normalize_plan(plan_data.get("plan", "Free"))

    if saved_plan in ["Go", "Pro"]:
        return saved_plan

    return "Free"


def resolve_effective_plan(client_id: str, requested_plan: str = "Free") -> str:
    saved_plan = get_saved_plan_for_client(client_id)

    if saved_plan in ["Go", "Pro"]:
        return saved_plan

    return "Free"


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str):
    client = get_razorpay_client()

    payload = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": signature,
    }

    try:
        client.utility.verify_payment_signature(payload)
        return True
    except Exception:
        pass

    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature, signature)


def save_created_payment_order(order_id: str, client_id: str, plan: str, amount: int):
    safe_id = safe_client_id(client_id)

    with payment_lock:
        store = load_payment_store()

        store.setdefault("orders", {})
        store["orders"][order_id] = {
            "client_id": safe_id,
            "plan": plan,
            "amount": amount,
            "status": "created",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        save_payment_store(store)


def mark_payment_success(order_id: str, payment_id: str, client_id: str, plan: str):
    safe_id = safe_client_id(client_id)

    with payment_lock:
        store = load_payment_store()
        order_data = store.get("orders", {}).get(order_id)

        if not order_data:
            raise HTTPException(
                status_code=404,
                detail="Payment order not found on backend.",
            )

        if order_data.get("client_id") != safe_id:
            raise HTTPException(
                status_code=403,
                detail="Payment order does not belong to this user.",
            )

        if order_data.get("plan") != plan:
            raise HTTPException(
                status_code=400,
                detail="Payment plan mismatch.",
            )

        order_data["status"] = "paid"
        order_data["payment_id"] = payment_id
        order_data["paid_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        store.setdefault("plans", {})
        store["plans"][safe_id] = {
            "plan": plan,
            "payment_id": payment_id,
            "order_id": order_id,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        store["orders"][order_id] = order_data
        save_payment_store(store)

    return get_saved_plan_for_client(safe_id)


def parse_youtube_iso8601_duration(duration: str) -> int:
    if not duration:
        return 0

    pattern = (
        r"P"
        r"(?:(?P<days>\d+)D)?"
        r"(?:T"
        r"(?:(?P<hours>\d+)H)?"
        r"(?:(?P<minutes>\d+)M)?"
        r"(?:(?P<seconds>\d+)S)?"
        r")?"
    )

    match = re.fullmatch(pattern, duration)

    if not match:
        return 0

    days = int(match.group("days") or 0)
    hours = int(match.group("hours") or 0)
    minutes = int(match.group("minutes") or 0)
    seconds = int(match.group("seconds") or 0)

    return (days * 24 * 3600) + (hours * 3600) + (minutes * 60) + seconds


def seconds_to_hours(seconds: int) -> float:
    if not seconds or seconds <= 0:
        return 1 / 60

    return seconds / 3600


def fetch_youtube_duration_hours(video_url: str) -> tuple[float, dict]:
    video_id = extract_youtube_video_id(video_url)

    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Cannot fetch video duration.",
        )

    if not YOUTUBE_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="YouTube API key is missing on backend.",
        )

    params = urllib.parse.urlencode(
        {
            "part": "contentDetails,snippet,status",
            "id": video_id,
            "key": YOUTUBE_API_KEY,
        }
    )

    api_url = f"https://www.googleapis.com/youtube/v3/videos?{params}"

    try:
        with urllib.request.urlopen(api_url, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch YouTube video duration. Reason: {str(error)}",
        )

    items = payload.get("items", [])

    if not items:
        raise HTTPException(
            status_code=404,
            detail="YouTube video not found or not accessible through YouTube Data API.",
        )

    video = items[0]
    content_details = video.get("contentDetails", {})
    snippet = video.get("snippet", {})
    status = video.get("status", {})

    iso_duration = content_details.get("duration", "")
    duration_seconds = parse_youtube_iso8601_duration(iso_duration)
    duration_hours = seconds_to_hours(duration_seconds)

    return duration_hours, {
        "video_id": video_id,
        "title": snippet.get("title", "Uploaded Lecture"),
        "channel": snippet.get("channelTitle", ""),
        "iso_duration": iso_duration,
        "duration_seconds": duration_seconds,
        "duration_hours": round(duration_hours, 3),
        "privacy_status": status.get("privacyStatus", "unknown"),
    }


def get_gemini_client():
    if genai is None:
        return None

    if not GEMINI_API_KEY:
        return None

    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        try:
            return genai.Client()
        except Exception:
            return None


def get_ai_text(response) -> Optional[str]:
    output_text = getattr(response, "text", None)

    if output_text and str(output_text).strip():
        return str(output_text).strip()

    output_text = getattr(response, "output_text", None)

    if output_text and str(output_text).strip():
        return str(output_text).strip()

    return None


def call_gemini_video(youtube_url: str, prompt: str) -> tuple[Optional[str], Optional[str]]:
    client = get_gemini_client()

    if client is None:
        return None, "Gemini client is not available. Check GEMINI_API_KEY and google-genai installation."

    video_inputs_to_try = [
        youtube_url,
        youtube_url.replace("https://www.youtube.com/watch?v=", "https://youtu.be/"),
    ]

    last_error = None

    for video_input in video_inputs_to_try:
        try:
            if types is not None:
                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=[
                        types.Part(
                            file_data=types.FileData(
                                file_uri=video_input,
                                mime_type="video/mp4",
                            )
                        ),
                        prompt,
                    ],
                )

                output_text = get_ai_text(response)

                if output_text:
                    return output_text, None

            last_error = "Gemini returned an empty video analysis response."
        except Exception as error:
            last_error = str(error)

        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    {
                        "file_data": {
                            "file_uri": video_input,
                            "mime_type": "video/mp4",
                        }
                    },
                    prompt,
                ],
            )

            output_text = get_ai_text(response)

            if output_text:
                return output_text, None

            last_error = "Gemini returned an empty video analysis response."
        except Exception as error:
            last_error = str(error)

        try:
            if hasattr(client, "interactions"):
                interaction = client.interactions.create(
                    model=GEMINI_MODEL,
                    input=[
                        {
                            "type": "video",
                            "uri": video_input,
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                )

                output_text = getattr(interaction, "output_text", None)

                if output_text and output_text.strip():
                    return output_text.strip(), None

            last_error = "Gemini returned an empty video analysis response."
        except Exception as error:
            last_error = str(error)

    return None, last_error


def call_gemini_text(prompt: str) -> Optional[str]:
    client = get_gemini_client()

    if client is None:
        return None

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )

        output_text = get_ai_text(response)

        if output_text:
            return output_text
    except Exception:
        pass

    try:
        if hasattr(client, "interactions"):
            interaction = client.interactions.create(
                model=GEMINI_MODEL,
                input=[
                    {
                        "type": "text",
                        "text": prompt,
                    }
                ],
            )

            output_text = getattr(interaction, "output_text", None)

            if output_text:
                return output_text.strip()
    except Exception:
        pass

    return None


def extract_json_from_ai_text(text: str) -> Optional[dict]:
    if not text:
        return None

    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    try:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            return json.loads(match.group(0))
    except Exception:
        pass

    return None


def normalize_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    return []


def normalize_mcqs(value):
    clean_mcqs = []

    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue

            question = str(item.get("question", "")).strip()
            options = item.get("options", [])
            answer = str(item.get("answer", "")).strip()

            if question and isinstance(options, list) and len(options) >= 4 and answer:
                clean_mcqs.append(
                    {
                        "question": question,
                        "options": [str(option).strip() for option in options[:4]],
                        "answer": answer,
                    }
                )

    return clean_mcqs[:10]


def normalize_flashcards(value):
    clean_cards = []

    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue

            front = str(item.get("front", "")).strip()
            back = str(item.get("back", "")).strip()

            if front and back:
                clean_cards.append(
                    {
                        "front": front,
                        "back": back,
                    }
                )

    return clean_cards[:10]


def validate_study_pack_json(ai_json: dict):
    if not isinstance(ai_json, dict):
        raise HTTPException(
            status_code=502,
            detail="Video AI failed to return a valid study pack. Please try again.",
        )

    if ai_json.get("error"):
        raise HTTPException(
            status_code=422,
            detail=str(ai_json.get("message") or "This video could not be processed by video AI."),
        )

    summary = str(ai_json.get("summary") or "").strip()
    notes = normalize_list(ai_json.get("notes"))
    exam_focus = normalize_list(ai_json.get("exam_focus"))

    if not summary or len(notes) < 3 or len(exam_focus) < 2:
        raise HTTPException(
            status_code=502,
            detail="Video AI could not extract enough reliable study content from this video. Try another public lecture video.",
        )


def build_video_analysis_prompt(clean_topic: str):
    return f"""
You are VidGen AI, a multimodal lecture analysis engine for Indian students.

Analyze this video using BOTH:
1. Spoken audio / narration
2. Visual frames / slides / board writing / diagrams / on-screen text

Topic label from user:
{clean_topic}

Important rules:
- Do NOT create generic content.
- Do NOT guess unrelated topics.
- Use only what you can understand from the actual video audio and visual content.
- If the video is unclear, mention only what is clearly understandable.
- If the video contains board work, slides, diagrams, equations, code, or screen text, include those visual points.
- Make the output useful for B.Tech/ECE/engineering-style exam preparation when applicable.

Return ONLY valid JSON. No markdown. No extra text outside JSON.

JSON format:
{{
  "title": "short title based on actual video content",
  "detected_topic": "main topic detected from audio and visuals",
  "summary": "150 to 220 words summary based only on actual video",
  "visual_insights": [
    "important things seen in frames/slides/board/screen"
  ],
  "audio_insights": [
    "important things heard in explanation/audio"
  ],
  "notes": [
    "10 to 14 smart study notes based on video"
  ],
  "exam_focus": [
    "6 to 10 exam-focused/high scoring points from video"
  ],
  "two_mark_questions": [
    "8 two-mark questions answerable from video"
  ],
  "ten_mark_questions": [
    "5 ten-mark questions answerable from video"
  ],
  "mcqs": [
    {{
      "question": "MCQ question from video",
      "options": ["option A", "option B", "option C", "option D"],
      "answer": "correct option text"
    }}
  ],
  "flashcards": [
    {{
      "front": "question side from video",
      "back": "answer side from video"
    }}
  ],
  "cram_sheet": [
    "8 to 10 last-minute revision points from video"
  ],
  "timestamps": [
    "important timestamps or approximate moments if available"
  ]
}}
"""


def create_study_pack_from_ai_json(ai_json: dict, title_fallback: str, source_status: str, accuracy: str):
    validate_study_pack_json(ai_json)

    title = str(ai_json.get("title") or ai_json.get("detected_topic") or title_fallback).strip()
    summary = str(ai_json.get("summary") or "").strip()

    visual_insights = normalize_list(ai_json.get("visual_insights"))
    audio_insights = normalize_list(ai_json.get("audio_insights"))
    notes = normalize_list(ai_json.get("notes"))
    exam_focus = normalize_list(ai_json.get("exam_focus"))
    two_mark_questions = normalize_list(ai_json.get("two_mark_questions"))
    ten_mark_questions = normalize_list(ai_json.get("ten_mark_questions"))
    cram_sheet = normalize_list(ai_json.get("cram_sheet"))
    timestamps = normalize_list(ai_json.get("timestamps"))

    combined_notes = []

    if visual_insights:
        combined_notes.append("Visual insights from video frames/slides:")
        combined_notes.extend(visual_insights)

    if audio_insights:
        combined_notes.append("Audio insights from lecture explanation:")
        combined_notes.extend(audio_insights)

    combined_notes.extend(notes)

    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "source_status": source_status,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": summary,
        "visual_insights": visual_insights,
        "audio_insights": audio_insights,
        "notes": combined_notes,
        "exam_focus": exam_focus,
        "two_mark_questions": two_mark_questions,
        "ten_mark_questions": ten_mark_questions,
        "mcqs": normalize_mcqs(ai_json.get("mcqs")),
        "flashcards": normalize_flashcards(ai_json.get("flashcards")),
        "cram_sheet": cram_sheet,
        "timestamps": timestamps,
        "duration": "Multimodal video AI pack",
        "accuracy": accuracy,
    }


def build_multimodal_study_pack(topic: str, video_url: str):
    video_id, canonical_url = get_canonical_youtube_url(video_url)
    clean_topic = topic.strip() if topic and topic.strip() else "Uploaded Lecture"
    prompt = build_video_analysis_prompt(clean_topic)

    ai_text, error_message = call_gemini_video(canonical_url, prompt)

    if not ai_text:
        raise HTTPException(
            status_code=502,
            detail=(
                "Video AI could not process this YouTube video directly. "
                "This can happen with YouTube Live videos, private/unlisted videos, restricted videos, or videos not supported by Gemini YouTube URL preview. "
                "Try a normal public YouTube lecture video or use Upload Video mode. "
                f"Reason: {error_message or 'Unknown error'}"
            ),
        )

    ai_json = extract_json_from_ai_text(ai_text)

    if not ai_json:
        raise HTTPException(
            status_code=502,
            detail="Video AI response was not in a valid format. Please try again.",
        )

    study_pack = create_study_pack_from_ai_json(
        ai_json=ai_json,
        title_fallback=clean_topic,
        source_status="Gemini multimodal analysis completed using YouTube video audio and visual frames.",
        accuracy="YouTube audio + visual video analysis",
    )

    study_pack["video_id"] = video_id
    study_pack["video_url"] = canonical_url

    return study_pack


def get_file_state_name(file_obj):
    state = getattr(file_obj, "state", None)

    if state is None:
        return ""

    return getattr(state, "name", str(state))


def get_file_mime_type(file_path: str, upload_mime_type: str = "") -> str:
    if upload_mime_type and upload_mime_type != "application/octet-stream":
        return upload_mime_type

    guessed_mime, _ = mimetypes.guess_type(file_path)

    return guessed_mime or "video/mp4"


async def save_uploaded_video(upload_file: UploadFile) -> tuple[str, str]:
    original_name = upload_file.filename or "uploaded_video.mp4"
    file_extension = os.path.splitext(original_name)[1] or ".mp4"

    with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
        temp_path = temp_file.name
        total_size = 0

        while True:
            chunk = await upload_file.read(1024 * 1024)

            if not chunk:
                break

            total_size += len(chunk)

            if total_size > MAX_UPLOAD_BYTES:
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

                raise HTTPException(
                    status_code=413,
                    detail="Video is too large for this demo server. Upload a short lecture video under 200MB.",
                )

            temp_file.write(chunk)

    mime_type = get_file_mime_type(temp_path, upload_file.content_type or "")

    if mime_type not in SUPPORTED_VIDEO_MIME_TYPES:
        try:
            os.remove(temp_path)
        except Exception:
            pass

        raise HTTPException(
            status_code=400,
            detail="Unsupported video format. Upload MP4, MOV, AVI, WebM, MPEG, WMV, FLV, MPG, or 3GPP.",
        )

    return temp_path, mime_type


def call_gemini_uploaded_video(file_path: str, mime_type: str, prompt: str) -> tuple[Optional[str], Optional[str]]:
    client = get_gemini_client()

    if client is None:
        return None, "Gemini client is not available. Check GEMINI_API_KEY and google-genai installation."

    try:
        uploaded_file = client.files.upload(file=file_path)

        start_time = time.time()

        while get_file_state_name(uploaded_file) not in ["ACTIVE", "FAILED"]:
            if time.time() - start_time > 300:
                return None, "Gemini file processing timed out."

            time.sleep(5)
            uploaded_file = client.files.get(name=uploaded_file.name)

        if get_file_state_name(uploaded_file) == "FAILED":
            return None, "Gemini file processing failed."

        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[uploaded_file, prompt],
            )

            output_text = get_ai_text(response)

            if output_text:
                return output_text, None
        except Exception as error:
            return None, str(error)

        return None, "Gemini returned an empty uploaded-video response."

    except Exception as error:
        return None, str(error)


def build_uploaded_video_study_pack(topic: str, file_path: str, mime_type: str):
    clean_topic = topic.strip() if topic and topic.strip() else "Uploaded Lecture"
    prompt = build_video_analysis_prompt(clean_topic)

    ai_text, error_message = call_gemini_uploaded_video(
        file_path=file_path,
        mime_type=mime_type,
        prompt=prompt,
    )

    if not ai_text:
        raise HTTPException(
            status_code=502,
            detail=(
                "Uploaded video AI analysis failed. Try a shorter MP4 lecture video. "
                f"Reason: {error_message or 'Unknown error'}"
            ),
        )

    ai_json = extract_json_from_ai_text(ai_text)

    if not ai_json:
        raise HTTPException(
            status_code=502,
            detail="Video AI response was not in valid JSON format. Please try again.",
        )

    return create_study_pack_from_ai_json(
        ai_json=ai_json,
        title_fallback=clean_topic,
        source_status="Gemini multimodal analysis completed using uploaded video audio and visual frames.",
        accuracy="Uploaded video audio + visual analysis",
    )


def ask_ai_tutor(question: str, topic: str, notes: List[str]):
    clean_question = question.strip()
    clean_topic = topic.strip() if topic and topic.strip() else "this lecture"
    notes_context = "\n".join(notes[:14]) if notes else "No generated notes provided."

    prompt = f"""
You are VidGen AI Tutor.

Answer only using the generated study pack notes below.
If the answer is not clearly available from the notes, say:
"This answer is not clearly available from the generated video study pack."

Topic:
{clean_topic}

Generated video study pack notes:
{notes_context}

Student question:
{clean_question}

Answer in simple, clear, exam-ready language.
Use:
1. Direct answer
2. Simple explanation
3. Exam writing tip
"""

    ai_text = call_gemini_text(prompt)

    if ai_text:
        return ai_text.strip()

    return (
        "This answer is not clearly available from the generated video study pack. "
        "Please regenerate the pack or ask a question from the visible notes."
    )


@app.get("/")
def root():
    return {
        "message": "VidGen AI Backend is running successfully.",
        "status": "ok",
        "version": "3.2.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "youtube_api_enabled": bool(YOUTUBE_API_KEY),
        "razorpay_enabled": bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and razorpay is not None),
        "model": GEMINI_MODEL,
        "multimodal_video_ai": True,
        "usage_limits": {
            "Free": "4 hrs/day",
            "Go": "10 hrs/day",
            "Pro": "16 hrs/day",
        },
        "payment_test_prices": {
            "Go": "₹1",
            "Pro": "₹2",
        },
        "docs": "Open /docs to test APIs.",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VidGen AI Backend",
        "version": "3.2.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "youtube_api_enabled": bool(YOUTUBE_API_KEY),
        "razorpay_enabled": bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and razorpay is not None),
        "model": GEMINI_MODEL,
        "multimodal_video_ai": True,
        "usage_limits": {
            "Free": "4 hrs/day",
            "Go": "10 hrs/day",
            "Pro": "16 hrs/day",
        },
        "payment_test_prices": {
            "Go": "₹1",
            "Pro": "₹2",
        },
    }


@app.get("/api/user-plan")
def user_plan(client_id: str = "anonymous"):
    plan = get_saved_plan_for_client(client_id)

    return {
        "success": True,
        "client_id": safe_client_id(client_id),
        "plan": plan,
        "limit_hours": get_plan_limit_hours(plan),
    }


@app.get("/api/usage-status")
def usage_status(client_id: str = "anonymous", plan: str = "Free"):
    effective_plan = resolve_effective_plan(client_id, plan)

    return {
        "success": True,
        "usage_status": get_usage_status_data(client_id, effective_plan),
    }


@app.post("/api/payment/create-order")
def create_payment_order(request: CreatePaymentOrderRequest):
    plan = normalize_plan(request.plan)

    if plan not in ["Go", "Pro"]:
        raise HTTPException(
            status_code=400,
            detail="Only Go and Pro plans require payment.",
        )

    payment_details = PLAN_PAYMENT_DETAILS[plan]
    amount = payment_details["amount"]

    client = get_razorpay_client()
    receipt_id = f"vidgen_{uuid.uuid4().hex[:24]}"

    try:
        order = client.order.create(
            {
                "amount": amount,
                "currency": "INR",
                "receipt": receipt_id,
                "notes": {
                    "product": "VidGen AI",
                    "plan": plan,
                    "client_id": safe_client_id(request.client_id or "anonymous"),
                },
            }
        )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not create Razorpay order. Reason: {str(error)}",
        )

    save_created_payment_order(
        order_id=order["id"],
        client_id=request.client_id or "anonymous",
        plan=plan,
        amount=amount,
    )

    return {
        "success": True,
        "key_id": RAZORPAY_KEY_ID,
        "order_id": order["id"],
        "amount": amount,
        "currency": "INR",
        "plan": plan,
        "display_amount": payment_details["display_amount"],
        "hours": payment_details["hours"],
    }


@app.post("/api/payment/verify")
def verify_payment(request: VerifyPaymentRequest):
    plan = normalize_plan(request.plan)

    if plan not in ["Go", "Pro"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid paid plan.",
        )

    is_valid_signature = verify_razorpay_signature(
        order_id=request.razorpay_order_id,
        payment_id=request.razorpay_payment_id,
        signature=request.razorpay_signature,
    )

    if not is_valid_signature:
        raise HTTPException(
            status_code=400,
            detail="Invalid Razorpay payment signature.",
        )

    updated_plan = mark_payment_success(
        order_id=request.razorpay_order_id,
        payment_id=request.razorpay_payment_id,
        client_id=request.client_id or "anonymous",
        plan=plan,
    )

    return {
        "success": True,
        "message": f"{updated_plan} plan activated successfully.",
        "plan": updated_plan,
        "limit_hours": get_plan_limit_hours(updated_plan),
    }


@app.get("/api/youtube-url-check")
def youtube_url_check(url: str):
    video_id = extract_youtube_video_id(url)

    if not video_id:
        return {
            "valid": False,
            "message": "Invalid YouTube URL.",
            "video_id": None,
            "canonical_url": None,
        }

    return {
        "valid": True,
        "message": "Valid YouTube URL.",
        "video_id": video_id,
        "canonical_url": f"https://www.youtube.com/watch?v={video_id}",
    }


@app.get("/api/youtube-metadata")
def youtube_metadata(url: str):
    duration_hours, metadata = fetch_youtube_duration_hours(url)

    return {
        "success": True,
        "duration_hours": round(duration_hours, 3),
        "metadata": metadata,
    }


@app.post("/api/generate-study-pack")
def generate_study_pack(request: GenerateStudyPackRequest):
    if not request.video_url or not request.video_url.strip():
        raise HTTPException(
            status_code=400,
            detail="YouTube video URL is required.",
        )

    effective_plan = resolve_effective_plan(
        request.client_id or "anonymous",
        request.plan or "Free",
    )

    duration_hours, youtube_metadata_data = fetch_youtube_duration_hours(
        request.video_url
    )

    check_usage_limit_or_raise(
        client_id=request.client_id or "anonymous",
        plan=effective_plan,
        requested_hours=duration_hours,
    )

    study_pack = build_multimodal_study_pack(
        topic=youtube_metadata_data.get("title") or request.topic or "Uploaded Lecture",
        video_url=request.video_url,
    )

    usage_status_data = record_usage_hours(
        client_id=request.client_id or "anonymous",
        plan=effective_plan,
        charged_hours=duration_hours,
        source="youtube",
    )

    study_pack["youtube_metadata"] = youtube_metadata_data
    study_pack["charged_hours"] = round(duration_hours, 3)
    study_pack["usage_status"] = usage_status_data

    return {
        "success": True,
        "message": "Multimodal video AI study pack generated successfully.",
        "charged_hours": round(duration_hours, 3),
        "usage_status": usage_status_data,
        "study_pack": study_pack,
    }


@app.post("/api/generate-study-pack-upload")
async def generate_study_pack_upload(
    video_file: UploadFile = File(...),
    topic: str = Form("Uploaded Lecture"),
    account_type: str = Form("student"),
    plan: str = Form("free"),
    client_id: str = Form("anonymous"),
    video_duration_hours: float = Form(1.0),
):
    temp_path = None
    charged_hours = max(float(video_duration_hours or 1.0), 1 / 60)

    effective_plan = resolve_effective_plan(
        client_id or "anonymous",
        plan or "Free",
    )

    check_usage_limit_or_raise(
        client_id=client_id or "anonymous",
        plan=effective_plan,
        requested_hours=charged_hours,
    )

    try:
        temp_path, mime_type = await save_uploaded_video(video_file)

        study_pack = build_uploaded_video_study_pack(
            topic=topic,
            file_path=temp_path,
            mime_type=mime_type,
        )

        usage_status_data = record_usage_hours(
            client_id=client_id or "anonymous",
            plan=effective_plan,
            charged_hours=charged_hours,
            source="upload",
        )

        study_pack["charged_hours"] = round(charged_hours, 3)
        study_pack["usage_status"] = usage_status_data

        return {
            "success": True,
            "message": "Uploaded video AI study pack generated successfully.",
            "charged_hours": round(charged_hours, 3),
            "usage_status": usage_status_data,
            "study_pack": study_pack,
        }

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.post("/api/ask-tutor")
def ask_tutor(request: TutorRequest):
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question is required.",
        )

    topic = request.topic or "Lecture Topic"

    answer = ask_ai_tutor(
        question=request.question,
        topic=topic,
        notes=request.notes or [],
    )

    return {
        "success": True,
        "topic": topic,
        "question": request.question,
        "answer": answer,
    }


def create_pdf_file(request: ExportPDFRequest):
    if canvas is None:
        raise HTTPException(
            status_code=500,
            detail="PDF package is not installed properly. Run python -m pip install reportlab.",
        )

    export_dir = BASE_DIR / "exports"
    export_dir.mkdir(exist_ok=True)

    file_name = f"vidgen_study_pack_{uuid.uuid4().hex[:8]}.pdf"
    file_path = export_dir / file_name

    pdf = canvas.Canvas(str(file_path), pagesize=A4)
    width, height = A4

    x = inch * 0.7
    y = height - inch * 0.7

    def write_wrapped_line(text, font_size=10, gap=15, bold=False):
        nonlocal y

        safe_text = str(text or "").strip()

        if not safe_text:
            return

        if y < inch:
            pdf.showPage()
            y = height - inch * 0.7

        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", font_size)

        max_chars = 88
        words = safe_text.split()
        line = ""

        for word in words:
            test_line = f"{line} {word}".strip()

            if len(test_line) <= max_chars:
                line = test_line
            else:
                pdf.drawString(x, y, line)
                y -= gap
                line = word

                if y < inch:
                    pdf.showPage()
                    y = height - inch * 0.7
                    pdf.setFont("Helvetica-Bold" if bold else "Helvetica", font_size)

        if line:
            pdf.drawString(x, y, line)
            y -= gap

    write_wrapped_line("VIDGEN AI - STUDY PACK", 16, 24, True)
    write_wrapped_line(request.title, 14, 22, True)

    write_wrapped_line("Summary", 13, 20, True)
    write_wrapped_line(request.summary, 10, 16)

    write_wrapped_line("Smart Notes", 13, 20, True)
    for item in request.notes:
        write_wrapped_line(f"- {item}", 10, 15)

    write_wrapped_line("Exam Focus", 13, 20, True)
    for item in request.exam_focus:
        write_wrapped_line(f"- {item}", 10, 15)

    write_wrapped_line("Practice Questions", 13, 20, True)
    for item in request.questions:
        write_wrapped_line(f"- {item}", 10, 15)

    pdf.save()

    return file_name, str(file_path)


@app.post("/api/export-pdf")
def export_pdf(request: ExportPDFRequest):
    file_name, file_path = create_pdf_file(request)

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=file_name,
    )


@app.post("/api/create-pdf-download")
def create_pdf_download(request: ExportPDFRequest):
    file_name, _ = create_pdf_file(request)

    return {
        "success": True,
        "file_name": file_name,
        "download_url": f"/api/download-pdf/{file_name}",
    }


@app.get("/api/download-pdf/{file_name}")
def download_pdf(file_name: str):
    if "/" in file_name or "\\" in file_name or ".." in file_name:
        raise HTTPException(status_code=400, detail="Invalid file name.")

    file_path = BASE_DIR / "exports" / file_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found.")

    return FileResponse(
        str(file_path),
        media_type="application/pdf",
        filename=file_name,
    )
from secure_routes import install_secure_routes

install_secure_routes(app, globals())