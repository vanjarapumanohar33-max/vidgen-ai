import { supabase } from "../lib/supabaseClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

/*
 * Reads the old random browser ID only for one-time migration.
 * After the backend transfers the old Go/Pro plan to the real
 * Supabase user ID, this value is deleted.
 */
function getLegacyClientId() {
  return (
    localStorage.getItem("vidgen_client_id") || ""
  );
}

function clearLegacyIdentityData() {
  localStorage.removeItem("vidgen_client_id");
  localStorage.removeItem("vidgen_daily_hours");
  localStorage.removeItem(
    "vidgen_payment_preview"
  );
}

function clearAuthCompatibilityData() {
  const authKeys = [
    "vidgen_is_logged_in",
    "vidgen_logged_in",
    "vidgen_auth_user_id",
    "vidgen_email",
    "vidgen_full_name",
    "vidgen_account_type",
    "vidgen_college",
    "vidgen_branch",
    "vidgen_semester",
    "vidgen_goal",
  ];

  authKeys.forEach((key) => {
    localStorage.removeItem(key);
  });
}

async function clearExpiredSession() {
  try {
    await supabase.auth.signOut({
      scope: "local",
    });
  } catch (error) {
    console.error(
      "Could not clear expired Supabase session:",
      error
    );
  }

  clearAuthCompatibilityData();
}

async function getAuthenticatedHeaders() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(
      error.message ||
        "Could not read your login session."
    );
  }

  if (!session?.access_token) {
    throw new Error(
      "Your secure login session is missing or expired. Please log in again."
    );
  }

  const headers = {
    Authorization: `Bearer ${session.access_token}`,
  };

  /*
   * This header is used only once to transfer the previous
   * client-ID plan and usage to the authenticated user.
   */
  const legacyClientId =
    getLegacyClientId();

  if (legacyClientId) {
    headers[
      "X-Vidgen-Legacy-Client-Id"
    ] = legacyClientId;
  }

  return headers;
}

function getFriendlyError(
  error,
  fallbackMessage
) {
  if (error?.name === "AbortError") {
    return "Backend is taking longer than expected. Please try again in 30 seconds.";
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
    payload?.youtubeUrl ||
    payload?.youtube_url ||
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
    "Uploaded Lecture"
  );
}

async function requestJson(
  endpoint,
  options = {},
  timeoutMs = 180000
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const authenticatedHeaders =
      await getAuthenticatedHeaders();

    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type":
            "application/json",
          ...(options.headers || {}),
          ...authenticatedHeaders,
        },
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearExpiredSession();
      }

      const backendMessage =
        data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`;

      throw new Error(backendMessage);
    }

    return data;
  } catch (error) {
    throw new Error(
      getFriendlyError(
        error,
        "Something went wrong while connecting to VidGen AI backend."
      ),
      {
        cause: error,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function requestFormData(
  endpoint,
  formData,
  timeoutMs = 300000
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const authenticatedHeaders =
      await getAuthenticatedHeaders();

    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: authenticatedHeaders,
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearExpiredSession();
      }

      const backendMessage =
        data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`;

      throw new Error(backendMessage);
    }

    return data;
  } catch (error) {
    throw new Error(
      getFriendlyError(
        error,
        "Something went wrong while uploading video to VidGen AI backend."
      ),
      {
        cause: error,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

function syncUsageToLocalStorage(
  usageStatus
) {
  if (!usageStatus) {
    return;
  }

  const usedHours = Number(
    usageStatus.used_hours || 0
  );

  if (!Number.isNaN(usedHours)) {
    localStorage.setItem(
      "vidgen_used_hours",
      String(usedHours)
    );

    localStorage.setItem(
      "vidgen_usage_date",
      usageStatus.date || ""
    );
  }

  if (usageStatus.plan) {
    localStorage.setItem(
      "vidgen_plan",
      usageStatus.plan
    );
  }
}

async function getUploadedVideoDurationHours(
  file
) {
  return new Promise((resolve) => {
    try {
      const video =
        document.createElement("video");

      const objectUrl =
        URL.createObjectURL(file);

      video.preload = "metadata";

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);

        const seconds = Number(
          video.duration || 0
        );

        if (
          !seconds ||
          Number.isNaN(seconds)
        ) {
          resolve(1);
          return;
        }

        resolve(
          Math.max(
            seconds / 3600,
            1 / 60
          )
        );
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(1);
      };

      video.src = objectUrl;
    } catch {
      resolve(1);
    }
  });
}

function loadRazorpayScript() {
  return new Promise(
    (resolve, reject) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript =
        document.querySelector(
          'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        );

      if (existingScript) {
        existingScript.onload = () => {
          resolve(true);
        };

        existingScript.onerror = () => {
          reject(
            new Error(
              "Razorpay checkout script failed to load."
            )
          );
        };

        return;
      }

      const script =
        document.createElement("script");

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.async = true;

      script.onload = () => {
        resolve(true);
      };

      script.onerror = () => {
        reject(
          new Error(
            "Razorpay checkout script failed to load."
          )
        );
      };

      document.body.appendChild(script);
    }
  );
}

/*
 * Kept for compatibility with existing components.
 * It now returns the authenticated Supabase user ID,
 * not the old random browser client ID.
 */
export function getVidgenClientId() {
  return (
    localStorage.getItem(
      "vidgen_auth_user_id"
    ) || ""
  );
}

export async function getUserPlan() {
  const data = await requestJson(
    "/api/user-plan",
    {
      method: "GET",
    },
    30000
  );

  if (data?.plan) {
    localStorage.setItem(
      "vidgen_plan",
      data.plan
    );
  }

  if (data?.user_id) {
    localStorage.setItem(
      "vidgen_auth_user_id",
      data.user_id
    );
  }

  /*
   * The secure backend has now had a chance to
   * migrate the old client ID to this user.
   */
  clearLegacyIdentityData();

  return data;
}

export async function getUsageStatus(
  plan = "Free"
) {
  /*
   * Kept only because existing components may still
   * pass a plan argument. The backend now determines
   * the real plan from the authenticated user.
   */
  void plan;

  const data = await requestJson(
    "/api/usage-status",
    {
      method: "GET",
    },
    30000
  );

  syncUsageToLocalStorage(
    data?.usage_status
  );

  if (data?.user_id) {
    localStorage.setItem(
      "vidgen_auth_user_id",
      data.user_id
    );
  }

  return data?.usage_status;
}

export async function upgradePlanWithRazorpay(
  targetPlan
) {
  const cleanPlan = String(
    targetPlan || ""
  ).trim();

  if (
    !["Go", "Pro"].includes(cleanPlan)
  ) {
    throw new Error(
      "Please choose Go or Pro plan."
    );
  }

  const orderData = await requestJson(
    "/api/payment/create-order",
    {
      method: "POST",
      body: JSON.stringify({
        plan: cleanPlan,
      }),
    },
    60000
  );

  if (
    !orderData?.success ||
    !orderData?.order_id ||
    !orderData?.key_id
  ) {
    throw new Error(
      "Could not create Razorpay order. Please try again."
    );
  }

  await loadRazorpayScript();

  return new Promise(
    (resolve, reject) => {
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency:
          orderData.currency || "INR",
        name: "VidGen AI",
        description:
          `${cleanPlan} Plan Upgrade`,
        order_id: orderData.order_id,

        prefill: {
          name:
            localStorage.getItem(
              "vidgen_full_name"
            ) || "",

          email:
            localStorage.getItem(
              "vidgen_email"
            ) || "",
        },

        theme: {
          color: "#e50914",
        },

        handler: async function (
          response
        ) {
          try {
            const verifyData =
              await requestJson(
                "/api/payment/verify",
                {
                  method: "POST",
                  body: JSON.stringify({
                    plan: cleanPlan,

                    razorpay_order_id:
                      response
                        .razorpay_order_id,

                    razorpay_payment_id:
                      response
                        .razorpay_payment_id,

                    razorpay_signature:
                      response
                        .razorpay_signature,
                  }),
                },
                60000
              );

            if (!verifyData?.success) {
              throw new Error(
                "Payment verification failed."
              );
            }

            localStorage.setItem(
              "vidgen_plan",
              verifyData.plan ||
                cleanPlan
            );

            resolve(verifyData);
          } catch (error) {
            reject(error);
          }
        },

        modal: {
          ondismiss: function () {
            reject(
              new Error(
                "Payment cancelled."
              )
            );
          },
        },
      };

      const razorpay =
        new window.Razorpay(options);

      razorpay.open();
    }
  );
}

export async function generateStudyPack(
  payload
) {
  try {
    const videoUrl =
      getVideoUrl(payload);

    const topic = getTopic(payload);

    if (!videoUrl) {
      throw new Error(
        "Please paste a valid YouTube URL."
      );
    }

    const data = await requestJson(
      "/api/generate-study-pack",
      {
        method: "POST",
        body: JSON.stringify({
          video_url: videoUrl,
          topic,

          account_type:
            payload?.account_type ||
            payload?.accountType ||
            "student",

          plan:
            payload?.plan || "free",
        }),
      },
      240000
    );

    const finalPack =
      data?.study_pack || data;

    if (
      !data?.success ||
      !finalPack
    ) {
      throw new Error(
        "Video AI could not generate the study pack."
      );
    }

    finalPack.usage_status =
      data?.usage_status || null;

    finalPack.charged_hours =
      data?.charged_hours || null;

    syncUsageToLocalStorage(
      data?.usage_status
    );

    return finalPack;
  } catch (error) {
    throw new Error(
      getFriendlyError(
        error,
        "Video AI generation failed. Try a public YouTube lecture video."
      ),
      {
        cause: error,
      }
    );
  }
}

export async function generateStudyPackFromUpload(
  file,
  options = {}
) {
  try {
    if (!file) {
      throw new Error(
        "Please select a video file first."
      );
    }

    const maxSize =
      200 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new Error(
        "Video file is too large. Upload a short video under 200MB."
      );
    }

    const durationHours =
      await getUploadedVideoDurationHours(
        file
      );

    const formData =
      new FormData();

    formData.append(
      "video_file",
      file
    );

    formData.append(
      "topic",
      options.topic ||
        "Uploaded Lecture"
    );

    formData.append(
      "account_type",
      options.account_type ||
        options.accountType ||
        "student"
    );

    formData.append(
      "plan",
      options.plan || "free"
    );

    formData.append(
      "video_duration_hours",
      String(durationHours)
    );

    const data =
      await requestFormData(
        "/api/generate-study-pack-upload",
        formData,
        360000
      );

    const finalPack =
      data?.study_pack || data;

    if (
      !data?.success ||
      !finalPack
    ) {
      throw new Error(
        "Uploaded video AI could not generate the study pack."
      );
    }

    finalPack.usage_status =
      data?.usage_status || null;

    finalPack.charged_hours =
      data?.charged_hours || null;

    syncUsageToLocalStorage(
      data?.usage_status
    );

    return finalPack;
  } catch (error) {
    throw new Error(
      getFriendlyError(
        error,
        "Uploaded video analysis failed. Try a shorter MP4 lecture video."
      ),
      {
        cause: error,
      }
    );
  }
}

export async function askTutor(
  payload
) {
  try {
    if (
      !payload?.question ||
      !payload.question.trim()
    ) {
      throw new Error(
        "Please type your question first."
      );
    }

    const data = await requestJson(
      "/api/ask-tutor",
      {
        method: "POST",
        body: JSON.stringify({
          question:
            payload.question,

          topic:
            payload.topic ||
            "Lecture Topic",

          notes:
            payload.notes || [],
        }),
      },
      90000
    );

    if (
      !data?.success ||
      !data?.answer
    ) {
      throw new Error(
        "AI Tutor could not answer right now."
      );
    }

    return data.answer;
  } catch (error) {
    throw new Error(
      getFriendlyError(
        error,
        "AI Tutor failed to respond. Please try again."
      ),
      {
        cause: error,
      }
    );
  }
}

export async function exportStudyPackPDF(
  studyPack
) {
  try {
    if (!studyPack) {
      throw new Error(
        "No study pack found to export."
      );
    }

    const questions = [
      ...(
        studyPack
          .two_mark_questions || []
      ),

      ...(
        studyPack
          .ten_mark_questions || []
      ),

      ...(
        studyPack.cram_sheet || []
      ),

      ...(
        studyPack
          .visual_insights || []
      ),

      ...(
        studyPack
          .audio_insights || []
      ),
    ];

    const data = await requestJson(
      "/api/create-pdf-download",
      {
        method: "POST",
        body: JSON.stringify({
          title:
            studyPack.title ||
            "VidGen AI Study Pack",

          summary:
            studyPack.summary || "",

          notes:
            studyPack.notes || [],

          exam_focus:
            studyPack.exam_focus || [],

          questions,
        }),
      },
      120000
    );

    if (
      !data?.success ||
      !data?.download_url
    ) {
      throw new Error(
        "PDF could not be prepared."
      );
    }

    const fileName =
      data.file_name ||
      "vidgen_study_pack.pdf";

    const downloadLink =
      document.createElement("a");

    downloadLink.href =
      `${API_BASE_URL}${data.download_url}`;

    downloadLink.setAttribute(
      "download",
      fileName
    );

    downloadLink.setAttribute(
      "target",
      "_blank"
    );

    downloadLink.setAttribute(
      "rel",
      "noopener noreferrer"
    );

    document.body.appendChild(
      downloadLink
    );

    downloadLink.click();

    document.body.removeChild(
      downloadLink
    );

    return true;
  } catch (error) {
    throw new Error(
      getFriendlyError(
        error,
        "PDF export failed. Please generate a study pack and try again."
      ),
      {
        cause: error,
      }
    );
  }
}