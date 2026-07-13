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


app = FastAPI(
    title="VidGen AI Backend",
    description="Multimodal AI backend for VidGen AI video study pack generation.",
    version="3.0.0",
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


def call_gemini_video(youtube_url: str, prompt: str) -> tuple[Optional[str], Optional[str]]:
    client = get_gemini_client()

    if client is None:
        return None, "Gemini client is not available. Check GEMINI_API_KEY and google-genai installation."

    try:
        interaction = client.interactions.create(
            model=GEMINI_MODEL,
            input=[
                {
                    "type": "text",
                    "text": prompt,
                },
                {
                    "type": "video",
                    "uri": youtube_url,
                },
            ],
        )

        output_text = getattr(interaction, "output_text", None)

        if output_text and output_text.strip():
            return output_text.strip(), None

        return None, "Gemini returned an empty video analysis response."
    except Exception as error:
        return None, str(error)


def call_gemini_text(prompt: str) -> Optional[str]:
    client = get_gemini_client()

    if client is None:
        return None

    try:
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


def build_multimodal_study_pack(topic: str, video_url: str):
    video_id, canonical_url = get_canonical_youtube_url(video_url)
    clean_topic = topic.strip() if topic and topic.strip() else "Uploaded Lecture"

    prompt = f"""
You are VidGen AI, a multimodal lecture analysis engine for Indian students.

Analyze this YouTube video using BOTH:
1. Spoken audio / narration
2. Visual frames / slides / board writing / diagrams / on-screen text

Video topic label from user:
{clean_topic}

Important rules:
- Do NOT create generic content.
- Do NOT guess unrelated topics.
- Use only what you can understand from the actual video audio and visual content.
- If you cannot access or analyze the video, return JSON with:
  {{"error": "VIDEO_NOT_ACCESSIBLE", "message": "This YouTube video could not be processed by video AI."}}
- If the video is a live stream or long lecture, focus on the clearly understandable educational content.
- If the video contains board work, slides, diagrams, equations, code, or screen text, include those important visual points.
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

    ai_text, error_message = call_gemini_video(canonical_url, prompt)

    if not ai_text:
        raise HTTPException(
            status_code=502,
            detail=(
                "Video AI could not process this YouTube video. "
                "Make sure the video is public and try again. "
                f"Reason: {error_message or 'Unknown error'}"
            ),
        )

    ai_json = extract_json_from_ai_text(ai_text)

    if not ai_json:
        raise HTTPException(
            status_code=502,
            detail="Video AI response was not in a valid format. Please try again.",
        )

    validate_study_pack_json(ai_json)

    title = str(ai_json.get("title") or ai_json.get("detected_topic") or clean_topic).strip()
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
        "video_id": video_id,
        "video_url": canonical_url,
        "source_status": "Gemini multimodal analysis completed using video audio and visual frames.",
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
        "accuracy": "Audio + visual video analysis",
    }


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
        f"This answer is not clearly available from the generated video study pack. "
        f"Please regenerate the pack or ask a question from the visible notes."
    )


@app.get("/")
def root():
    return {
        "message": "VidGen AI Backend is running successfully.",
        "status": "ok",
        "version": "3.0.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "model": GEMINI_MODEL,
        "multimodal_video_ai": True,
        "docs": "Open /docs to test APIs.",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VidGen AI Backend",
        "version": "3.0.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "model": GEMINI_MODEL,
        "multimodal_video_ai": True,
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


@app.post("/api/generate-study-pack")
def generate_study_pack(request: GenerateStudyPackRequest):
    if not request.video_url or not request.video_url.strip():
        raise HTTPException(
            status_code=400,
            detail="YouTube video URL is required.",
        )

    study_pack = build_multimodal_study_pack(
        topic=request.topic or "Uploaded Lecture",
        video_url=request.video_url,
    )

    return {
        "success": True,
        "message": "Multimodal video AI study pack generated successfully.",
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