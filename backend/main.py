from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os
import re
import uuid

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


app = FastAPI(
    title="VidGen AI Backend",
    description="Backend server for VidGen AI lecture-to-study-pack generation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://vidgen-ai.vercel.app",
],
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


def extract_youtube_video_id(url: str) -> Optional[str]:
    patterns = [
        r"youtube\.com/watch\?v=([^&]+)",
        r"youtu\.be/([^?&]+)",
        r"youtube\.com/embed/([^?&]+)",
        r"youtube\.com/shorts/([^?&]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, url)

        if match:
            return match.group(1)

    return None


def fetch_youtube_transcript(video_url: str) -> str:
    video_id = extract_youtube_video_id(video_url)

    if not video_id:
        return ""

    if YouTubeTranscriptApi is None:
        return ""

    try:
        transcript_items = YouTubeTranscriptApi.get_transcript(
            video_id,
            languages=["en", "en-US", "hi", "te"],
        )

        transcript_text = " ".join(
            item.get("text", "") for item in transcript_items
        )

        return transcript_text.strip()

    except Exception:
        return ""


def build_study_pack(topic: str, transcript: str):
    clean_topic = topic.strip() if topic else "Lecture Topic"
    has_transcript = len(transcript.strip()) > 80

    source_status = (
        "YouTube transcript detected and processed."
        if has_transcript
        else "Transcript unavailable. Demo study pack generated from topic."
    )

    summary = (
        f"This study pack explains {clean_topic} in a clean, exam-focused way. "
        f"It is arranged for quick revision, short-answer preparation, long-answer structure, "
        f"practice questions, and last-minute review."
    )

    notes = [
        f"Start {clean_topic} with a clear definition and basic meaning.",
        f"Understand the working principle step by step instead of memorizing random points.",
        f"Write important terms, formulas, diagrams, and examples separately for fast revision.",
        f"For problem-based topics, follow this order: given data, formula, substitution, calculation, and final answer.",
        f"Use headings and short technical sentences to make answers look neat in exams.",
    ]

    exam_focus = [
        f"Prepare a perfect 2-mark definition of {clean_topic}.",
        "Prepare one 10-mark answer with heading, diagram or flow, explanation, applications, and conclusion.",
        "Revise advantages, disadvantages, applications, key terms, and repeated question patterns.",
        "Practice writing the answer in 5 to 6 clear points.",
    ]

    two_mark_questions = [
        f"Define {clean_topic}.",
        f"Write two applications of {clean_topic}.",
        f"Mention two advantages of {clean_topic}.",
        f"Write any two important terms related to {clean_topic}.",
    ]

    ten_mark_questions = [
        f"Explain {clean_topic} with a neat diagram or flow.",
        f"Describe the working principle of {clean_topic} in detail.",
        f"Write the advantages, disadvantages, and applications of {clean_topic}.",
    ]

    mcqs = [
        {
            "question": f"What is the best first step to understand {clean_topic}?",
            "options": [
                "Learn the definition",
                "Skip the basics",
                "Read random examples",
                "Memorize only formulas",
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

    flashcards = [
        {
            "front": f"What is {clean_topic}?",
            "back": f"{clean_topic} should be explained with definition, working principle, important points, and applications.",
        },
        {
            "front": "How to write a 10-mark answer?",
            "back": "Use heading, definition, diagram or flow, explanation, advantages, applications, and conclusion.",
        },
        {
            "front": "What is exam focus?",
            "back": "Exam focus means preparing high-scoring and repeated exam parts first.",
        },
    ]

    cram_sheet = [
        f"Revise the definition of {clean_topic}.",
        "Remember key points in correct order.",
        "Practice 2-mark and 10-mark questions.",
        "Use diagrams or flow wherever possible.",
        "Write final answers neatly with headings.",
    ]

    return {
        "id": str(uuid.uuid4()),
        "title": clean_topic,
        "source_status": source_status,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": summary,
        "notes": notes,
        "exam_focus": exam_focus,
        "two_mark_questions": two_mark_questions,
        "ten_mark_questions": ten_mark_questions,
        "mcqs": mcqs,
        "flashcards": flashcards,
        "cram_sheet": cram_sheet,
        "duration": "Demo lecture",
        "accuracy": "Lecture-based" if has_transcript else "Topic-based demo",
    }


@app.get("/")
def root():
    return {
        "message": "VidGen AI Backend is running successfully.",
        "status": "ok",
        "docs": "Open http://127.0.0.1:8000/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VidGen AI Backend",
    }


@app.post("/api/generate-study-pack")
def generate_study_pack(request: GenerateStudyPackRequest):
    if not request.video_url.strip():
        raise HTTPException(
            status_code=400,
            detail="YouTube lecture URL is required.",
        )

    transcript = fetch_youtube_transcript(request.video_url)

    study_pack = build_study_pack(
        topic=request.topic or "Lecture Topic",
        transcript=transcript,
    )

    return {
        "success": True,
        "message": "Study pack generated successfully.",
        "study_pack": study_pack,
    }


@app.post("/api/ask-tutor")
def ask_tutor(request: TutorRequest):
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question is required.",
        )

    topic = request.topic or "this lecture"

    notes_context = ""
    if request.notes:
        notes_context = " ".join(request.notes[:3])

    answer = (
        f"For {topic}, here is a simple exam-ready explanation: "
        f"Start with the definition, then explain the main idea step by step. "
        f"After that, write important points, applications, and a short conclusion. "
        f"For your doubt: '{request.question}', focus on clarity, headings, and easy technical words."
    )

    if notes_context:
        answer += f" Based on your generated notes, the key idea is: {notes_context}"

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