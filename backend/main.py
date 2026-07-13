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


app = FastAPI(
    title="VidGen AI Backend",
    description="AI-powered backend server for VidGen AI lecture-to-study-pack generation.",
    version="2.0.0",
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
    topic: Optional[str] = "Lecture Topic"
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


def fetch_youtube_transcript(video_url: str) -> tuple[str, str]:
    video_id = extract_youtube_video_id(video_url)

    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please paste a valid YouTube video, shorts, live, embed, or youtu.be link.",
        )

    if YouTubeTranscriptApi is None:
        return "", "Transcript package unavailable. AI generated content from topic only."

    try:
        transcript_items = YouTubeTranscriptApi.get_transcript(
            video_id,
            languages=["en", "en-US", "en-GB", "hi", "te"],
        )

        transcript_text = " ".join(
            item.get("text", "") for item in transcript_items
        )

        transcript_text = transcript_text.strip()

        if transcript_text:
            return transcript_text, "YouTube transcript detected and processed."

        return "", "Transcript was empty. AI generated content from topic only."

    except Exception:
        return "", "Transcript unavailable for this video. AI generated content from topic only."


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
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            return json.loads(match.group(0))
    except Exception:
        pass

    return None


def normalize_list(value, fallback):
    if isinstance(value, list) and len(value) > 0:
        return [str(item).strip() for item in value if str(item).strip()]

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
            "question": f"What is the first step to understand {topic}?",
            "options": [
                "Learn the definition",
                "Skip the basics",
                "Only memorize formulas",
                "Ignore examples",
            ],
            "answer": "Learn the definition",
        },
        {
            "question": "Which format is best for exam answers?",
            "options": [
                "Step-by-step points",
                "One long paragraph",
                "Only keywords",
                "No headings",
            ],
            "answer": "Step-by-step points",
        },
        {
            "question": "Which section helps in last-minute revision?",
            "options": [
                "Cram sheet",
                "Random notes",
                "Unverified content",
                "Only long answers",
            ],
            "answer": "Cram sheet",
        },
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
            "front": f"What is {topic}?",
            "back": f"{topic} should be explained with definition, working principle, important points, and applications.",
        },
        {
            "front": "How to write a 10-mark answer?",
            "back": "Use heading, definition, diagram or flow, explanation, advantages, applications, and conclusion.",
        },
    ]


def build_demo_study_pack(topic: str, transcript: str, source_status: str):
    clean_topic = topic.strip() if topic and topic.strip() else "Lecture Topic"
    has_transcript = len(transcript.strip()) > 80

    summary = (
        f"This study pack explains {clean_topic} in a clean, exam-focused way. "
        f"It is arranged for quick revision, short-answer preparation, long-answer structure, "
        f"practice questions, and last-minute review."
    )

    if has_transcript:
        summary = (
            f"This study pack is generated using the available YouTube transcript for {clean_topic}. "
            f"The content is arranged into exam-focused notes, revision points, practice questions, "
            f"and a short cram sheet for faster preparation."
        )

    notes = [
        f"Start {clean_topic} with a clear definition and basic meaning.",
        f"Understand the working principle step by step instead of memorizing random points.",
        f"Write important terms, formulas, diagrams, and examples separately for fast revision.",
        f"For problem-based topics, follow this order: given data, formula, substitution, calculation, and final answer.",
        f"Use headings and short technical sentences to make answers look neat in exams.",
    ]

    if has_transcript:
        transcript_preview = transcript[:700].replace("\n", " ").strip()

        notes.insert(
            1,
            f"Lecture context detected: {transcript_preview}...",
        )

    return {
        "id": str(uuid.uuid4()),
        "title": clean_topic,
        "source_status": source_status,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": summary,
        "notes": notes,
        "exam_focus": [
            f"Prepare a perfect 2-mark definition of {clean_topic}.",
            "Prepare one 10-mark answer with heading, diagram or flow, explanation, applications, and conclusion.",
            "Revise advantages, disadvantages, applications, key terms, and repeated question patterns.",
            "Practice writing the answer in 5 to 6 clear points.",
        ],
        "two_mark_questions": [
            f"Define {clean_topic}.",
            f"Write two applications of {clean_topic}.",
            f"Mention two advantages of {clean_topic}.",
            f"Write any two important terms related to {clean_topic}.",
        ],
        "ten_mark_questions": [
            f"Explain {clean_topic} with a neat diagram or flow.",
            f"Describe the working principle of {clean_topic} in detail.",
            f"Write the advantages, disadvantages, and applications of {clean_topic}.",
        ],
        "mcqs": normalize_mcqs([], clean_topic),
        "flashcards": normalize_flashcards([], clean_topic),
        "cram_sheet": [
            f"Revise the definition of {clean_topic}.",
            "Remember key points in correct order.",
            "Practice 2-mark and 10-mark questions.",
            "Use diagrams or flow wherever possible.",
            "Write final answers neatly with headings.",
        ],
        "duration": "AI lecture pack",
        "accuracy": "Lecture-based" if has_transcript else "Topic-based AI",
    }


def build_ai_study_pack(topic: str, transcript: str, source_status: str):
    clean_topic = topic.strip() if topic and topic.strip() else "Lecture Topic"
    has_transcript = len(transcript.strip()) > 80

    transcript_for_ai = transcript[:14000].replace("\n", " ").strip()

    content_source = (
        f"LECTURE TRANSCRIPT:\n{transcript_for_ai}"
        if has_transcript
        else "No transcript is available. Generate a useful exam-ready study pack using the topic only."
    )

    prompt = f"""
You are VidGen AI, an expert study assistant for Indian engineering students.

Create an exam-ready study pack for this topic:
{clean_topic}

{content_source}

Return ONLY valid JSON. Do not use markdown. Do not add explanation outside JSON.

JSON format:
{{
  "title": "short clean topic title",
  "summary": "120 to 180 words simple explanation",
  "notes": [
    "8 to 12 smart notes in simple exam-ready language"
  ],
  "exam_focus": [
    "5 to 8 high scoring exam focus points"
  ],
  "two_mark_questions": [
    "8 two-mark exam questions"
  ],
  "ten_mark_questions": [
    "5 ten-mark exam questions"
  ],
  "mcqs": [
    {{
      "question": "MCQ question",
      "options": ["option A", "option B", "option C", "option D"],
      "answer": "correct option text"
    }}
  ],
  "flashcards": [
    {{
      "front": "question side",
      "back": "answer side"
    }}
  ],
  "cram_sheet": [
    "8 last-minute revision points"
  ]
}}

Rules:
- Use simple Indian student-friendly English.
- Make it useful for B.Tech/ECE style exam preparation.
- If transcript is available, base the content on the transcript.
- If transcript is unavailable, create a general but useful study pack from the topic.
- Keep every point clean, direct, and exam-ready.
- MCQs must have exactly 4 options each.
"""

    ai_text = call_gemini(prompt)
    ai_json = extract_json_from_ai_text(ai_text)

    if not ai_json:
        return build_demo_study_pack(
            clean_topic,
            transcript,
            source_status + " AI response unavailable, fallback pack generated.",
        )

    title = str(ai_json.get("title") or clean_topic).strip()

    fallback_pack = build_demo_study_pack(clean_topic, transcript, source_status)

    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "source_status": source_status + " AI generation completed.",
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
        "duration": "AI lecture pack",
        "accuracy": "AI + transcript" if has_transcript else "AI topic-based",
    }


def ask_ai_tutor(question: str, topic: str, notes: List[str]):
    clean_question = question.strip()
    clean_topic = topic.strip() if topic and topic.strip() else "this lecture"
    notes_context = "\n".join(notes[:8]) if notes else "No generated notes provided."

    prompt = f"""
You are VidGen AI Tutor for an Indian engineering student.

Topic:
{clean_topic}

Generated lecture notes:
{notes_context}

Student question:
{clean_question}

Answer in simple, clear, exam-ready language.
Use this structure:
1. Direct answer
2. Simple explanation
3. Exam writing tip
Keep the answer useful and not too long.
"""

    ai_text = call_gemini(prompt)

    if ai_text:
        return ai_text.strip()

    fallback_answer = (
        f"For {clean_topic}, here is a simple exam-ready explanation: "
        f"Start with the definition, then explain the main idea step by step. "
        f"After that, write important points, applications, and a short conclusion. "
        f"For your doubt: '{clean_question}', focus on clarity, headings, and easy technical words."
    )

    if notes:
        fallback_answer += f" Based on your generated notes, the key idea is: {' '.join(notes[:3])}"

    return fallback_answer


@app.get("/")
def root():
    return {
        "message": "VidGen AI Backend is running successfully.",
        "status": "ok",
        "version": "2.0.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "model": GEMINI_MODEL,
        "docs": "Open /docs to test APIs.",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VidGen AI Backend",
        "version": "2.0.0",
        "ai_enabled": bool(GEMINI_API_KEY and genai is not None),
        "model": GEMINI_MODEL,
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


@app.post("/api/generate-study-pack")
def generate_study_pack(request: GenerateStudyPackRequest):
    if not request.video_url or not request.video_url.strip():
        raise HTTPException(
            status_code=400,
            detail="YouTube lecture URL is required.",
        )

    transcript, source_status = fetch_youtube_transcript(request.video_url)

    study_pack = build_ai_study_pack(
        topic=request.topic or "Lecture Topic",
        transcript=transcript,
        source_status=source_status,
    )

    return {
        "success": True,
        "message": "AI study pack generated successfully.",
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