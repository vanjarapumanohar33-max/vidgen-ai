const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function handleApiResponse(response) {
  if (!response.ok) {
    let errorMessage = "Something went wrong. Please try again.";

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response;
}

export async function generateStudyPack({
  videoUrl,
  topic,
  accountType = "student",
  plan = "free",
}) {
  const response = await fetch(`${API_BASE_URL}/api/generate-study-pack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_url: videoUrl,
      topic,
      account_type: accountType,
      plan,
    }),
  });

  await handleApiResponse(response);

  return response.json();
}

export async function askTutor({ question, topic, notes = [] }) {
  const response = await fetch(`${API_BASE_URL}/api/ask-tutor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      topic,
      notes,
    }),
  });

  await handleApiResponse(response);

  return response.json();
}

export async function exportStudyPackPDF({
  title,
  summary,
  notes,
  examFocus,
  questions,
}) {
  const response = await fetch(`${API_BASE_URL}/api/create-pdf-download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      summary,
      notes,
      exam_focus: examFocus,
      questions,
    }),
  });

  await handleApiResponse(response);

  const data = await response.json();

  if (!data.download_url) {
    throw new Error("PDF was created, but download URL was not returned.");
  }

  const downloadUrl = `${API_BASE_URL}${data.download_url}`;
  const fileName = data.file_name || "vidgen-study-pack.pdf";

  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.setAttribute("download", fileName);
  downloadLink.setAttribute("target", "_blank");

  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  return {
    success: true,
    downloadUrl,
    fileName,
  };
}