from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
import os
import re
import uuid
import json

load_dotenv()

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:
    YouTubeTranscriptApi = None

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


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

TRANSCRIPT_LANGUAGES = ["en", "en-US", "en-GB", "te", "hi"]


app = FastAPI(
    title="VidGen AI Backend",
    description="Transcript-first AI backend server for VidGen AI lecture study packs.",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://vidgen-ai.vercel.app",
    ],
    allow_origin_regex=r"https://.*\\.vercel\\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateStudyPackRequest(BaseModel):
    video_url: str
    topic: Optional[str] = "Uploaded Lecture"
    account_type: Optional[str] = "student"
    plan: Optional[str] = "free"


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
        r"(?:youtu\\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:shorts/)([a-zA-Z0-9_-]{11})",
        r"(?:embed/)([a-zA-Z0-9_-]{11})",
        r"(?:live/)([a-zA-Z0-9_-]{11})",
    ]

    for pattern in fallback_patterns:
        match = re.search(pattern, raw_url)
        if match:
            return clean_video_id(match.group(1))

    return None


def transcript_to_text(fetched_transcript) -> str:
    if not fetched_transcript:
        return ""

    try:
        raw_data = fetched_transcript.to_raw_data()
        return " ".join(item.get("text", "") for item in raw_data).strip()
    except Exception:
        pass

    try:
        return " ".join(
            getattr(snippet, "text", "") for snippet in fetched_transcript
        ).strip()
    except Exception:
        pass

    try:
        return " ".join(
            item.get("text", "") for item in fetched_transcript
        ).strip()
    except Exception:
        return ""


def fetch_youtube_transcript(video_url: str) -> tuple[str, str, bool]:
    video_id = extract_youtube_video_id(video_url)

    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please paste a valid YouTube video, shorts, live, embed, or youtu.be link.",
        )

    if YouTubeTranscriptApi is None:
        raise HTTPException(
            status_code=500,
            detail="Transcript package is not installed on backend.",
        )

    ytt_api = YouTubeTranscriptApi()

    try:
        fetched_transcript = ytt_api.fetch(
            video_id,
            languages=TRANSCRIPT_LANGUAGES,
        )

        transcript_text = transcript_to_text(fetched_transcript)

        if len(transcript_text) > 80:
            return (
                transcript_text,
                "YouTube transcript detected and processed.",
                True,
            )
    except Exception:
        pass

    try:
        transcript_list = ytt_api.list(video_id)

        selected_transcript = None

        try:
            selected_transcript = transcript_list.find_transcript(
                TRANSCRIPT_LANGUAGES
            )
        except Exception:
            pass

        if selected_transcript is None:
            for transcript in transcript_list:
                selected_transcript = transcript
                break

        if selected_transcript is None:
            raise Exception("No transcript found.")

        try:
            if (
                getattr(selected_transcript, "language_code", "") != "en"
                and getattr(selected_transcript, "is_translatable", False)
            ):
                selected_transcript = selected_transcript.translate("en")
        except Exception:
            pass

        fetched_transcript = selected_transcript.fetch()
        transcript_text = transcript_to_text(fetched_transcript)

        if len(transcript_text) > 80:
            language_code = getattr(selected_transcript, "language_code", "unknown")

            return (
                transcript_text,
                f"YouTube transcript detected and processed. Language: {language_code}.",
                True,
            )
    except Exception:
        pass

    raise HTTPException(
        status_code=422,
        detail=(
            "Transcript is unavailable for this video, so VidGen AI cannot generate a trusted video-based study pack. "
            "Try a YouTube lecture with captions/subtitles enabled."
        ),
    )


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


def call_gemini(prompt: str) -> Optional[str]:
    client = get_gemini_client()

    if client is None:
        return None

    try:
        interaction = client.interactions.create(
            model=GEMINI_MODEL,
            input=prompt,
        )

        output_text = getattr(interaction, "output_text", None)

        if output_text:
            return output_text.strip()
    except Exception:
        pass

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )

        output_text = getattr(response, "text", None)

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
        match = re.search(r"\\{[\\s\\S]*\\}", cleaned)
        if match:
            return json.loads(match.group(0))
    except Exception:
        pass

    return None


def normalize_list(value, fallback):
    if isinstance(value, list) and len(value) > 0:
        clean_items = [str(item).strip() for item in value if str(item).strip()]
        if clean_items:
            return clean_items

    return fallback


def normalize_mcqs(value, topic):
    if isinstance(value, list) and len(value) > 0:
        clean_mcqs = []

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

        if clean_mcqs:
            return clean_mcqs[:8]

    return [
        {
            "question": f"What is the main concept explained in {topic}?",
            "options": [
                "Definition and working",
                "Only unrelated examples",
                "No explanation",
                "Random facts",
            ],
            "answer": "Definition and working",
        }
    ]


def normalize_flashcards(value, topic):
    if isinstance(value, list) and len(value) > 0:
        clean_cards = []

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

        if clean_cards:
            return clean_cards[:8]

    return [
        {
            "front": f"What is the key idea of {topic}?",
            "back": "Read the smart notes and exam focus generated from the transcript.",
        }
    ]


def fallback_transcript_pack(topic: str, transcript: str, source_status: str):
    clean_topic = topic.strip() if topic and topic.strip() else "Uploaded Lecture"
    transcript_preview = transcript[:900].replace("\n", " ").strip()

    return {
        "id": str(uuid.uuid4()),
        "title": clean_topic,
        "source_status": source_status + " AI response failed, transcript fallback used.",
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": transcript_preview,
        "notes": [
            "Transcript was detected, but AI formatting failed.",
            "Use the transcript preview to revise the main idea.",
            "Try generating again after a few seconds.",
        ],
        "exam_focus": [
            "Read the transcript summary carefully.",
            "Prepare definitions and key terms from the lecture.",
            "Write answers using headings and step-by-step points.",
        ],
        "two_mark_questions": [
            "What is the main topic discussed in this lecture?",
            "Write two important points from the lecture.",
            "Mention one application from the lecture.",
        ],
        "ten_mark_questions": [
            "Explain the main concept discussed in this lecture.",
            "Write detailed notes from the lecture transcript.",
        ],
        "mcqs": normalize_mcqs([], clean_topic),
        "flashcards": normalize_flashcards([], clean_topic),
        "cram_sheet": [
            "Revise transcript summary.",
            "Mark important definitions.",
            "Prepare 2-mark and 10-mark answers.",
        ],
        "duration": "Transcript-based lecture pack",
        "accuracy": "Transcript-based fallback",
    }


def build_ai_study_pack(topic: str, transcript: str, source_status: str):
    clean_topic = topic.strip() if topic and topic.strip() else "Uploaded Lecture"
    transcript_for_ai = transcript[:18000].replace("\n", " ").strip()

    prompt = f"""
You are VidGen AI, a transcript-first study assistant for Indian engineering students.

You MUST use only the lecture transcript below.
Do NOT create generic content.
Do NOT add unrelated concepts.
If the transcript does not clearly mention something, do not invent it.

Topic label:
{clean_topic}

LECTURE TRANSCRIPT:
{transcript_for_ai}

Return ONLY valid JSON. Do not use markdown. Do not add explanation outside JSON.

JSON format:
{{
  "title": "short clean topic title based on transcript",
  "summary": "120 to 180 words summary strictly based on transcript",
  "notes": [
    "8 to 12 smart notes strictly from transcript"
  ],
  "exam_focus": [
    "5 to 8 exam focus points strictly from transcript"
  ],
  "two_mark_questions": [
    "8 two-mark questions answerable from transcript"
  ],
  "ten_mark_questions": [
    "5 ten-mark questions answerable from transcript"
  ],
  "mcqs": [
    {{
      "question": "MCQ question from transcript",
      "options": ["option A", "option B", "option C", "option D"],
      "answer": "correct option text"
    }}
  ],
  "flashcards": [
    {{
      "front": "question side from transcript",
      "back": "answer side from transcript"
    }}
  ],
  "cram_sheet": [
    "8 last-minute revision points strictly from transcript"
  ]
}}

Rules:
- Simple Indian student-friendly English.
- Useful for B.Tech/ECE-style exam preparation when possible.
- Every point must be traceable to the transcript.
- MCQs must have exactly 4 options each.
"""

    ai_text = call_gemini(prompt)
    ai_json = extract_json_from_ai_text(ai_text)

    if not ai_json:
        return fallback_transcript_pack(clean_topic, transcript, source_status)

    fallback_pack = fallback_transcript_pack(clean_topic, transcript, source_status)
    title = str(ai_json.get("title") or clean_topic).strip()

    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "source_status": source_status + " AI transcript-based generation completed.",
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": str(ai_json.get("summary") or fallback_pack["summary"]).strip(),
        "notes": normalize_list(ai_json.get("notes"), fallback_pack["notes"]),
        "exam_focus": normalize_list(ai_json.get("exam_focus"), fallback_pack["exam_focus"]),
        "two_mark_questions": normalize_list(
            ai_json.get("two_mark_questions"),
            fallback_pack["two_mark_questions"],
        ),
        "ten_mark_questions": normalize_list(
            ai_json.get("ten_mark_questions"),
            fallback_pack["ten_mark_questions"],
        ),
        "mcqs": normalize_mcqs(ai_json.get("mcqs"), title),
        "flashcards": normalize_flashcards(ai_json.get("flashcards"), title),
        "cram_sheet": normalize_list(ai_json.get("cram_sheet"), fallback_pack["cram_sheet"]),
        "duration": "Transcript-based lecture pack",
        "accuracy": "AI + transcript verified",
    }


def ask_ai_tutor(question: str, topic: str, notes: List[str]):
    clean_question = question.strip()
    clean_topic = topic.strip() if topic and topic.strip() else "this lecture"
    notes_context = "\n".join(notes[:10]) if notes else "No generated notes provided."

    prompt = f"""
You are VidGen AI Tutor.

Answer only using the generated notes below.
If the answer is not available in the notes, say:
"This answer is not clearly available from the generated lecture notes."

Topic:
{clean_topic}

Generated lecture notes:
{notes_context}

Student question:
{clean_question}

Answer in simple, clear, exam-ready language.
Use:
1. Direct answer
2. Simple explanation
3. Exam writing tip
"""

    ai_text = call_gemini(prompt)

    if ai_text:
        return ai_text.strip()

    return (
        f"For {clean_topic}, I can answer only from the generated lecture notes. "
        f"Your question was: {clean_question}. Please regenerate the pack or ask from the notes shown."
    )


@app.get("/")
def root():
    return {
        "message": "VidGen AI Backend is running successfully.",
        "status": "ok",
        "version": "2.1.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "model": GEMINI_MODEL,
        "transcript_first": True,
        "docs": "Open /docs to test APIs.",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VidGen AI Backend",
        "version": "2.1.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "model": GEMINI_MODEL,
        "transcript_first": True,
    }


@app.get("/api/youtube-url-check")
def youtube_url_check(url: str):
    video_id = extract_youtube_video_id(url)

    if not video_id:
        return {
            "valid": False,
            "message": "Invalid YouTube URL.",
            "video_id": None,
        }

    return {
        "valid": True,
        "message": "Valid YouTube URL.",
        "video_id": video_id,
    }


@app.get("/api/transcript-debug")
def transcript_debug(url: str):
    video_id = extract_youtube_video_id(url)

    if not video_id:
        return {
            "valid_url": False,
            "video_id": None,
            "transcript_available": False,
            "message": "Invalid YouTube URL.",
        }

    try:
        transcript, source_status, transcript_available = fetch_youtube_transcript(url)

        return {
            "valid_url": True,
            "video_id": video_id,
            "transcript_available": transcript_available,
            "transcript_length": len(transcript),
            "source_status": source_status,
            "preview": transcript[:700],
        }
    except HTTPException as error:
        return {
            "valid_url": True,
            "video_id": video_id,
            "transcript_available": False,
            "message": error.detail,
        }


@app.post("/api/generate-study-pack")
def generate_study_pack(request: GenerateStudyPackRequest):
    if not request.video_url or not request.video_url.strip():
        raise HTTPException(
            status_code=400,
            detail="YouTube lecture URL is required.",
        )

    transcript, source_status, transcript_available = fetch_youtube_transcript(
        request.video_url
    )

    if not transcript_available:
        raise HTTPException(
            status_code=422,
            detail="Transcript unavailable. Cannot generate trusted video-based content.",
        )

    study_pack = build_ai_study_pack(
        topic=request.topic or "Uploaded Lecture",
        transcript=transcript,
        source_status=source_status,
    )

    return {
        "success": True,
        "message": "Transcript-based AI study pack generated successfully.",
        "study_pack": study_pack,
    }


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

    export_dir = "exports"
    os.makedirs(export_dir, exist_ok=True)

    file_name = f"vidgen_study_pack_{uuid.uuid4().hex[:8]}.pdf"
    file_path = os.path.join(export_dir, file_name)

    pdf = canvas.Canvas(file_path, pagesize=A4)
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

    return file_name, file_path


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

    file_path = os.path.join("exports", file_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF file not found.")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=file_name,
    )