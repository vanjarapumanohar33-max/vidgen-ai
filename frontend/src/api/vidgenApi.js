const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function getFriendlyError(error, fallbackMessage) {
  if (error?.name === "AbortError") {
    return "Video AI is taking longer than expected. On free hosting, the backend may be waking up. Please try again in 30 seconds.";
  }

  if (error?.message) {
    return error.message;
  }

  return fallbackMessage;
}

function getVideoUrl(payload) {
  if (typeof payload === "string") {
    return payload.trim();
  }

  return (
    payload?.video_url ||
    payload?.videoUrl ||
    payload?.videoURL ||
    payload?.youtubeUrl ||
    payload?.youtubeURL ||
    payload?.youtube_url ||
    payload?.youtubeLink ||
    payload?.videoLink ||
    payload?.inputUrl ||
    payload?.lectureUrl ||
    payload?.lecture_url ||
    payload?.youtubeInput ||
    payload?.videoInput ||
    payload?.youtube ||
    payload?.video ||
    payload?.url ||
    payload?.link ||
    ""
  ).trim();
}

function getTopic(payload) {
  if (typeof payload === "string") {
    return "Uploaded Lecture";
  }

  return (
    payload?.topic ||
    payload?.title ||
    payload?.lectureTitle ||
    "Uploaded Lecture"
  );
}

async function requestJson(endpoint, options = {}, timeoutMs = 180000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const backendMessage =
        data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`;

      throw new Error(backendMessage);
    }

    return data;
  } catch (error) {
    const friendlyMessage = getFriendlyError(
      error,
      "Something went wrong while connecting to VidGen AI backend."
    );

    throw new Error(friendlyMessage, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestFormData(endpoint, formData, timeoutMs = 300000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const backendMessage =
        data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`;

      throw new Error(backendMessage);
    }

    return data;
  } catch (error) {
    const friendlyMessage = getFriendlyError(
      error,
      "Something went wrong while uploading video to VidGen AI backend."
    );

    throw new Error(friendlyMessage, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateStudyPack(payload) {
  try {
    const videoUrl = getVideoUrl(payload);
    const topic = getTopic(payload);

    if (!videoUrl) {
      throw new Error("Please paste a valid YouTube URL.");
    }

    const data = await requestJson(
      "/api/generate-study-pack",
      {
        method: "POST",
        body: JSON.stringify({
          video_url: videoUrl,
          topic,
          account_type:
            payload?.account_type || payload?.accountType || "student",
          plan: payload?.plan || "free",
        }),
      },
      240000
    );

    const finalPack = data?.study_pack || data;

    if (!data?.success || !finalPack) {
      throw new Error("Video AI could not generate the study pack. Please try again.");
    }

    return finalPack;
  } catch (error) {
    const friendlyMessage = getFriendlyError(
      error,
      "Video AI generation failed. Try a public YouTube lecture video."
    );

    throw new Error(friendlyMessage, { cause: error });
  }
}

export async function generateStudyPackFromUpload(file, options = {}) {
  try {
    if (!file) {
      throw new Error("Please select a video file first.");
    }

    const maxSize = 200 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new Error("Video file is too large. Upload a short video under 200MB.");
    }

    const formData = new FormData();

    formData.append("video_file", file);
    formData.append("topic", options.topic || "Uploaded Lecture");
    formData.append("account_type", options.account_type || options.accountType || "student");
    formData.append("plan", options.plan || "free");

    const data = await requestFormData(
      "/api/generate-study-pack-upload",
      formData,
      360000
    );

    const finalPack = data?.study_pack || data;

    if (!data?.success || !finalPack) {
      throw new Error("Uploaded video AI could not generate the study pack.");
    }

    return finalPack;
  } catch (error) {
    const friendlyMessage = getFriendlyError(
      error,
      "Uploaded video analysis failed. Try a shorter MP4 lecture video."
    );

    throw new Error(friendlyMessage, { cause: error });
  }
}

export async function askTutor(payload) {
  try {
    if (!payload?.question || !payload.question.trim()) {
      throw new Error("Please type your question first.");
    }

    const data = await requestJson(
      "/api/ask-tutor",
      {
        method: "POST",
        body: JSON.stringify({
          question: payload.question,
          topic: payload.topic || "Lecture Topic",
          notes: payload.notes || [],
        }),
      },
      90000
    );

    if (!data?.success || !data?.answer) {
      throw new Error("AI Tutor could not answer right now. Please try again.");
    }

    return data.answer;
  } catch (error) {
    const friendlyMessage = getFriendlyError(
      error,
      "AI Tutor failed to respond. Please try again."
    );

    throw new Error(friendlyMessage, { cause: error });
  }
}

export async function exportStudyPackPDF(studyPack) {
  try {
    if (!studyPack) {
      throw new Error("No study pack found to export.");
    }

    const questions = [
      ...(studyPack.two_mark_questions || []),
      ...(studyPack.ten_mark_questions || []),
      ...(studyPack.cram_sheet || []),
      ...(studyPack.visual_insights || []),
      ...(studyPack.audio_insights || []),
    ];

    const data = await requestJson(
      "/api/create-pdf-download",
      {
        method: "POST",
        body: JSON.stringify({
          title: studyPack.title || "VidGen AI Study Pack",
          summary: studyPack.summary || "",
          notes: studyPack.notes || [],
          exam_focus: studyPack.exam_focus || [],
          questions,
        }),
      },
      120000
    );

    if (!data?.success || !data?.download_url) {
      throw new Error("PDF could not be prepared. Please try again.");
    }

    const fileName = data.file_name || "vidgen_study_pack.pdf";
    const downloadLink = document.createElement("a");

    downloadLink.href = `${API_BASE_URL}${data.download_url}`;
    downloadLink.setAttribute("download", fileName);
    downloadLink.setAttribute("target", "_blank");

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    return true;
  } catch (error) {
    const friendlyMessage = getFriendlyError(
      error,
      "PDF export failed. Please generate a study pack and try again."
    );

    throw new Error(friendlyMessage, { cause: error });
  }
}