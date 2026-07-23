import { useEffect, useState } from "react";
import {
  MessageCircle,
  Download,
  Lock,
  Crown,
  Clock,
  ShieldCheck,
  BadgeCheck,
  BookOpen,
  GraduationCap,
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Layers,
  Brain,
  Sparkles,
  Copy,
} from "lucide-react";

import DashboardNavbar from "../components/DashboardNavbar";
import DashboardSidebar from "../components/DashboardSidebar";
import DashboardPanel from "../components/DashboardPanel";
import AITutorPanel from "../components/AITutorPanel";
import {
  exportStudyPackPDF,
  generateStudyPack,
  generateStudyPackFromUpload,
  getUsageStatus,
  getUserPlan,
  upgradePlanWithRazorpay,
} from "../api/vidgenApi";

import "./Dashboard.css";

function Dashboard() {
  const accountType =
    localStorage.getItem("vidgen_account_type") || "student";

  const [plan, setPlan] = useState(
    localStorage.getItem("vidgen_plan") || "Free"
  );

  const [url, setUrl] = useState("");
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [inputMode, setInputMode] = useState("youtube");

  const [videoId, setVideoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showTutor, setShowTutor] = useState(false);
  const [error, setError] = useState("");
  const [packNotice, setPackNotice] = useState("");
  const [panelType, setPanelType] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [activePackTab, setActivePackTab] = useState("notes");
  const [studyPack, setStudyPack] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [usedHours, setUsedHours] = useState(0);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
  async function loadPlanAndUsage() {
    try {
      const planData = await getUserPlan();

      const backendPlan =
        planData?.plan || localStorage.getItem("vidgen_plan") || "Free";

      setPlan(backendPlan);
      localStorage.setItem("vidgen_plan", backendPlan);

      const status = await getUsageStatus(backendPlan);
      const backendUsedHours = Number(status?.used_hours || 0);

      if (!Number.isNaN(backendUsedHours)) {
        setUsedHours(backendUsedHours);
      }
    } catch {
      setUsedHours(0);
    }
  }

  loadPlanAndUsage();
}, []);
  function getDailyLimitHours() {
    if (plan === "Go") return 10;
    if (plan === "Pro") return 16;
    return 4;
  }

  function formatHours(hours) {
    const safeHours = Math.max(0, Number(hours || 0));
    const totalMinutes = Math.round(safeHours * 60);
    const fullHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (fullHours <= 0) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }

    if (minutes === 0) {
      return `${fullHours} hour${fullHours !== 1 ? "s" : ""}`;
    }

    return `${fullHours} hour${fullHours !== 1 ? "s" : ""} ${minutes} minutes`;
  }

  function extractUrlFromText(inputText) {
    const text = String(inputText || "").trim();

    if (!text) return "";

    const urlMatch = text.match(
      /(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/[^\s]+/i
    );

    return urlMatch ? urlMatch[0].trim() : text;
  }

  function getVideoId(videoUrl) {
    const extractedUrl = extractUrlFromText(videoUrl);

    if (!extractedUrl) return null;

    try {
      const cleanUrl = extractedUrl.startsWith("http")
        ? extractedUrl
        : `https://${extractedUrl}`;

      const parsedUrl = new URL(cleanUrl);
      const hostname = parsedUrl.hostname.toLowerCase().replace("www.", "");
      const pathname = parsedUrl.pathname;

      if (
        hostname === "youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "music.youtube.com"
      ) {
        const watchId = parsedUrl.searchParams.get("v");

        if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
          return watchId;
        }

        const pathParts = pathname.split("/").filter(Boolean);

        if (
          ["shorts", "embed", "live", "v"].includes(pathParts[0]) &&
          pathParts[1] &&
          /^[a-zA-Z0-9_-]{11}$/.test(pathParts[1])
        ) {
          return pathParts[1];
        }
      }

      if (hostname === "youtu.be") {
        const id = pathname.split("/").filter(Boolean)[0];

        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }

      const fallbackMatch = cleanUrl.match(
        /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/
      );

      return fallbackMatch ? fallbackMatch[1] : null;
    } catch {
      const fallbackMatch = extractedUrl.match(
        /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/
      );

      return fallbackMatch ? fallbackMatch[1] : null;
    }
  }

  function getRemainingHours() {
    return getDailyLimitHours() - usedHours;
  }

  function getMCQCount() {
    if (plan === "Pro") return 25;
    if (plan === "Go") return 10;
    return 5;
  }

  function getFlashcardCount() {
    if (plan === "Pro") return 30;
    if (plan === "Go") return 15;
    return 5;
  }

  function hasGoAccess() {
    return plan === "Go" || plan === "Pro";
  }

  function hasProAccess() {
    return plan === "Pro";
  }

  function getArray(value, fallback = []) {
    return Array.isArray(value) && value.length > 0 ? value : fallback;
  }

  function applyBackendUsage(finalPack) {
    const backendUsage = finalPack?.usage_status;

    if (!backendUsage) return;

    const backendUsedHours = Number(backendUsage.used_hours || 0);

    if (!Number.isNaN(backendUsedHours)) {
      setUsedHours(backendUsedHours);
    }

    if (backendUsage.plan) {
      setPlan(backendUsage.plan);
      localStorage.setItem("vidgen_plan", backendUsage.plan);
    }
  }

  async function refreshBackendUsage(currentPlan = plan) {
    try {
      const status = await getUsageStatus(currentPlan);
      const backendUsedHours = Number(status?.used_hours || 0);

      if (!Number.isNaN(backendUsedHours)) {
        setUsedHours(backendUsedHours);
      }

      if (status?.plan) {
        setPlan(status.plan);
        localStorage.setItem("vidgen_plan", status.plan);
      }
    } catch {
      // Keep current display if backend usage fetch fails.
    }
  }

  async function handleUpgradePlan(targetPlan) {
    try {
      setIsUpgrading(true);
      setError("");
      setPackNotice("");

      const result = await upgradePlanWithRazorpay(targetPlan);

      const upgradedPlan = result?.plan || targetPlan;

      setPlan(upgradedPlan);
      localStorage.setItem("vidgen_plan", upgradedPlan);

      await refreshBackendUsage(upgradedPlan);

      setPackNotice(`${upgradedPlan} plan activated successfully.`);
    } catch (upgradeError) {
      setPackNotice(upgradeError.message || "Payment failed or cancelled.");
    } finally {
      setIsUpgrading(false);
    }
  }

  function saveToRecents(currentVideoId, currentUrl, currentPack) {
    const oldRecents = JSON.parse(
      localStorage.getItem("vidgen_recents") || "[]"
    );

    const newRecent = {
      id: currentPack?.id || `${currentVideoId}-${Date.now()}`,
      title: currentPack?.title || "Verified Study Pack",
      date: new Date().toLocaleString(),
      url: currentUrl,
      videoId: currentVideoId,
      plan,
      accountType,
      studyPack: currentPack,
    };

    const filteredRecents = oldRecents.filter(
      (item) => item.videoId !== currentVideoId
    );

    localStorage.setItem(
      "vidgen_recents",
      JSON.stringify([newRecent, ...filteredRecents].slice(0, 20))
    );
  }

  async function handleGenerate() {
    const cleanUrl = extractUrlFromText(url);
    const id = getVideoId(cleanUrl);

    if (!cleanUrl || !id) {
      setError("Please paste a valid YouTube URL.");
      return;
    }

    setUrl(cleanUrl);
    setError("");
    setPackNotice("");
    setVideoId(id);
    setLoading(true);
    setShowNotes(false);
    setPanelOpen(false);
    setActivePackTab("notes");
    setStudyPack(null);

    try {
      const result = await generateStudyPack({
        video_url: cleanUrl,
        videoUrl: cleanUrl,
        url: cleanUrl,
        topic: "Uploaded Lecture",
        account_type: accountType,
        accountType,
        plan,
      });

      const finalPack = result?.study_pack || result;

      if (!finalPack) {
        throw new Error("Study pack could not be generated. Please try again.");
      }

      setStudyPack(finalPack);
      applyBackendUsage(finalPack);
      saveToRecents(id, cleanUrl, finalPack);
      setShowNotes(true);

      if (finalPack?.charged_hours) {
        setPackNotice(
          `Generated successfully. Charged ${formatHours(
            finalPack.charged_hours
          )} from your daily limit.`
        );
      }
    } catch (apiError) {
      setError(apiError.message || "Unable to generate study pack right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadGenerate() {
    if (!selectedVideoFile) {
      setError("Please select a video file first.");
      return;
    }

    setError("");
    setPackNotice("");
    setVideoId("");
    setLoading(true);
    setShowNotes(false);
    setPanelOpen(false);
    setActivePackTab("notes");
    setStudyPack(null);

    try {
      const result = await generateStudyPackFromUpload(selectedVideoFile, {
        topic: selectedVideoFile.name || "Uploaded Lecture",
        account_type: accountType,
        accountType,
        plan,
      });

      const finalPack = result?.study_pack || result;

      if (!finalPack) {
        throw new Error("Uploaded video study pack could not be generated.");
      }

      const uploadId = `upload-${Date.now()}`;
      const uploadLabel = selectedVideoFile.name || "Uploaded Video";

      setStudyPack(finalPack);
      applyBackendUsage(finalPack);
      saveToRecents(uploadId, uploadLabel, finalPack);
      setShowNotes(true);

      if (finalPack?.charged_hours) {
        setPackNotice(
          `Generated using uploaded video audio + visual analysis. Charged ${formatHours(
            finalPack.charged_hours
          )} from your daily limit.`
        );
      } else {
        setPackNotice("Generated using uploaded video audio + visual analysis.");
      }
    } catch (apiError) {
      setError(apiError.message || "Unable to analyze uploaded video right now.");
    } finally {
      setLoading(false);
    }
  }

  function handleNewChat() {
    setUrl("");
    setSelectedVideoFile(null);
    setInputMode("youtube");
    setVideoId("");
    setLoading(false);
    setShowNotes(false);
    setShowTutor(false);
    setStudyPack(null);
    setError("");
    setPackNotice("");
    setPanelOpen(false);
    setActivePackTab("notes");
  }

  function handleOpenPanel(type) {
    setPanelType(type);
    setPanelOpen(true);
  }

  function handleOpenSavedItem(item) {
    setUrl(item.url || "");
    setVideoId(item.videoId?.startsWith("upload-") ? "" : item.videoId || "");
    setSelectedVideoFile(null);
    setInputMode(item.videoId?.startsWith("upload-") ? "upload" : "youtube");
    setLoading(false);
    setError("");
    setPanelOpen(false);
    setActivePackTab("notes");

    if (item.studyPack) {
      setStudyPack(item.studyPack);
      setShowNotes(true);
      setPackNotice("Loaded from your recent study packs.");
      return;
    }

    setStudyPack(null);
    setShowNotes(false);
    setPackNotice("This older recent item has no saved study pack. Generate again to reload it.");
  }

  function handleLockedFeature(message) {
    setPackNotice(message);
  }

  function changePackTab(tab) {
    setActivePackTab(tab);
    setPackNotice("");
  }

  const remainingHours = getRemainingHours();
  const mcqCount = getMCQCount();
  const flashcardCount = getFlashcardCount();

  const notes = getArray(studyPack?.notes, [
    "Generate a study pack to see AI-powered smart notes here.",
  ]);

  const examFocus = getArray(studyPack?.exam_focus, [
    "Generate a study pack to see exam-focused points here.",
  ]);

  const twoMarkQuestions = getArray(studyPack?.two_mark_questions, [
    "Define the main concept explained in this lecture.",
    "Write two important applications.",
    "Mention one key formula or step.",
  ]);

  const tenMarkQuestions = getArray(studyPack?.ten_mark_questions, [
    "Explain the concept with neat structure.",
    "Describe working, diagram, or process if present.",
    "Compare with related concepts.",
  ]);

  const mcqs = getArray(studyPack?.mcqs, []);
  const flashcards = getArray(studyPack?.flashcards, []);
  const cramSheet = getArray(studyPack?.cram_sheet, []);

  const studyTabs = [
    {
      id: "notes",
      label: "Study Notes",
      icon: <BookOpen size={16} />,
    },
    {
      id: "focus",
      label: accountType === "student" ? "Exam Focus" : "Key Insights",
      icon:
        accountType === "student" ? (
          <GraduationCap size={16} />
        ) : (
          <Sparkles size={16} />
        ),
    },
    {
      id: "practice",
      label: "Practice",
      icon: <HelpCircle size={16} />,
    },
    {
      id: "export",
      label: "Export",
      icon: <Download size={16} />,
    },
  ];

  function renderNotesTab() {
    return (
      <div className="pack-grid">
        <article className="pack-card pack-card-large">
          <div className="card-top">
            <div>
              <span className="card-tag">Lecture Overview</span>
              <h3>Clean summary from the uploaded lecture</h3>
            </div>

            <span className="source-chip">
              <ShieldCheck size={13} />
              AI generated
            </span>
          </div>

          <p>
            {studyPack?.summary ||
              "VidGen AI converts the lecture into clear study material so the user can revise faster without depending on random AI answers or scattered YouTube notes."}
          </p>
        </article>

        <article className="pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Smart Notes</span>
              <h3>Important points from the lecture</h3>
            </div>
          </div>

          <div className="timeline-list">
            {notes.slice(0, 6).map((item, index) => (
              <div className="timeline-item" key={`note-${index}`}>
                <span className="timestamp-chip">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Core Concepts</span>
              <h3>What the learner must remember</h3>
            </div>
          </div>

          <ul className="clean-list">
            {notes.slice(6, 12).length > 0
              ? notes.slice(6, 12).map((item, index) => (
                  <li key={`core-${index}`}>{item}</li>
                ))
              : [
                  "Important definitions",
                  "Step-by-step explanation",
                  "Formula or diagram areas if detected",
                  "Quick revision points",
                ].map((item, index) => (
                  <li key={`fallback-core-${index}`}>{item}</li>
                ))}
          </ul>
        </article>
      </div>
    );
  }

  function renderFocusTab() {
    if (accountType === "learner") {
      return (
        <div className="pack-grid">
          <article className="pack-card pack-card-large">
            <div className="card-top">
              <div>
                <span className="card-tag">Key Insights</span>
                <h3>Useful learning takeaways from the video</h3>
              </div>

              <span className="source-chip">
                <BadgeCheck size={13} />
                Learning focused
              </span>
            </div>

            <ul className="clean-list">
              {examFocus.map((item, index) => (
                <li key={`insight-${index}`}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="pack-card">
            <div className="card-top">
              <div>
                <span className="card-tag">Practical Use</span>
                <h3>Where this knowledge can be applied</h3>
              </div>
            </div>

            <ul className="clean-list">
              {cramSheet.length > 0
                ? cramSheet.slice(0, 5).map((item, index) => (
                    <li key={`practical-${index}`}>{item}</li>
                  ))
                : [
                    "Real-world usage of the concept",
                    "Important examples from the video",
                    "Follow-up topics to learn next",
                  ].map((item, index) => (
                    <li key={`fallback-practical-${index}`}>{item}</li>
                  ))}
            </ul>
          </article>

          <article className="pack-card premium-pack-card">
            <div className="card-top">
              <div>
                <span className="card-tag">Deep Insight Mode</span>
                <h3>For long learning videos and podcasts</h3>
              </div>

              <span className="source-chip">
                {hasProAccess() ? "Unlocked" : "Pro"}
              </span>
            </div>

            <p>
              Pro mode gives deeper insights, action steps, and reusable notes
              for long-form educational videos.
            </p>
          </article>
        </div>
      );
    }

    return (
      <div className="pack-grid">
        <article className="pack-card pack-card-large">
          <div className="card-top">
            <div>
              <span className="card-tag">Exam Priority</span>
              <h3>Exam-ready output, not normal summary</h3>
            </div>

            <span className="source-chip">
              <GraduationCap size={13} />
              Student mode
            </span>
          </div>

          <ul className="clean-list">
            {examFocus.map((item, index) => (
              <li key={`focus-${index}`}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Short Answers</span>
              <h3>2-mark and quick revision questions</h3>
            </div>
          </div>

          <ul className="question-list">
            {twoMarkQuestions.slice(0, 8).map((item, index) => (
              <li key={`two-${index}`}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Long Answers</span>
              <h3>10-mark preparation flow</h3>
            </div>
          </div>

          <ul className="question-list">
            {tenMarkQuestions.slice(0, 5).map((item, index) => (
              <li key={`ten-${index}`}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    );
  }

  function renderPracticeTab() {
    return (
      <div className="practice-layout">
        <div className="practice-summary-row">
          <div className="practice-pill">
            <HelpCircle size={16} />
            <span>{mcqCount} MCQs</span>
          </div>

          <div className="practice-pill">
            <Layers size={16} />
            <span>{flashcardCount} Flashcards</span>
          </div>

          <div className="practice-pill">
            <Brain size={16} />
            <span>
              {plan === "Free"
                ? "Basic practice"
                : plan === "Go"
                ? "Answers included"
                : "Detailed explanations"}
            </span>
          </div>
        </div>

        <article className="pack-card pack-card-large">
          <div className="card-top">
            <div>
              <span className="card-tag">Practice Preview</span>
              <h3>Questions generated from the same lecture</h3>
            </div>

            <span className="source-chip">
              <ShieldCheck size={13} />
              Lecture based
            </span>
          </div>

          <div className="mcq-preview">
            {(mcqs.length > 0 ? mcqs.slice(0, 5) : [1, 2, 3]).map(
              (item, index) => {
                const isRealMCQ = typeof item === "object";

                return (
                  <div className="mcq-preview-item" key={`mcq-${index}`}>
                    <h4>
                      {index + 1}.{" "}
                      {isRealMCQ
                        ? item.question
                        : "Which option best explains an important concept from this lecture?"}
                    </h4>

                    {isRealMCQ ? (
                      item.options?.slice(0, 4).map((option, optionIndex) => (
                        <p key={`mcq-${index}-option-${optionIndex}`}>
                          {String.fromCharCode(65 + optionIndex)}. {option}
                        </p>
                      ))
                    ) : (
                      <>
                        <p>A. Basic theory</p>
                        <p>B. Practical example</p>
                        <p>C. Concept application</p>
                        <p>D. All of the above</p>
                      </>
                    )}

                    {hasGoAccess() ? (
                      <div className="answer-mini">
                        <CheckCircle2 size={14} />
                        {isRealMCQ
                          ? `Answer: ${item.answer}`
                          : "Answer key included"}
                        {hasProAccess() && " with detailed explanation"}
                      </div>
                    ) : (
                      <div className="answer-lock-inline">
                        <Lock size={14} />
                        Answer key unlocks in Go
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </article>

        <div className="flashcard-grid">
          {(flashcards.length > 0
            ? flashcards.slice(0, 2)
            : [
                {
                  front: "What is the main concept of this lecture?",
                  back: "Lecture-based short answer will appear here.",
                },
                {
                  front: "How should I revise this topic?",
                  back: "Use notes, questions, flashcards, and cram sheet.",
                },
              ]
          ).map((card, index) => (
            <article className="flashcard" key={`flash-${index}`}>
              <span className="flashcard-label">
                {index === 0 ? "Front" : "Back"}
              </span>
              <h3>{card.front}</h3>
              <p>{card.back}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  async function handleExportPDF() {
    if (!studyPack) {
      setPackNotice("Generate a study pack first, then export the PDF.");
      return;
    }

    try {
      setIsExportingPDF(true);
      await exportStudyPackPDF(studyPack);
      setPackNotice("PDF export started successfully.");
    } catch (apiError) {
      setPackNotice(apiError.message || "Unable to export PDF right now.");
    } finally {
      setIsExportingPDF(false);
    }
  }

  function renderExportButton({
    icon,
    title,
    desc,
    access,
    lockedMessage,
  }) {
    const locked = !access;

    return (
      <button
        type="button"
        disabled={isExportingPDF}
        className={locked ? "export-card locked-export" : "export-card"}
        onClick={() => {
          if (locked) {
            handleLockedFeature(lockedMessage);
            return;
          }

          if (title === "Copy Notes") {
            if (!studyPack) {
              setPackNotice("Generate a study pack first, then copy notes.");
              return;
            }

            const copiedNotes = [
              studyPack.title || "VidGen Study Pack",
              studyPack.summary || "",
              ...(studyPack.notes || []),
              ...(studyPack.exam_focus || []),
              ...(studyPack.two_mark_questions || []),
              ...(studyPack.ten_mark_questions || []),
              ...(studyPack.cram_sheet || []),
            ].join("\n\n");

            navigator.clipboard.writeText(copiedNotes);
            setPackNotice("Notes copied successfully.");
            return;
          }

          handleExportPDF();
        }}
      >
        <span className="export-icon">
          {locked ? <Lock size={18} /> : icon}
        </span>

        <span>
          <strong>{title}</strong>
          <small>{desc}</small>
        </span>

        <em>{locked ? "Locked" : isExportingPDF ? "Exporting" : "Ready"}</em>
      </button>
    );
  }

  function renderExportTab() {
    return (
      <div className="export-layout">
        <article className="pack-card pack-card-large">
          <div className="card-top">
            <div>
              <span className="card-tag">Transparent Export</span>
              <h3>No hidden paywall confusion</h3>
            </div>

            <span className="source-chip">{plan} plan</span>
          </div>

          <p>
            Free users can copy basic notes. Go and Pro users can unlock better
            limits and advanced usage flow.
          </p>
        </article>

        <div className="export-grid">
          {renderExportButton({
            icon: <Copy size={18} />,
            title: "Copy Notes",
            desc: "Basic notes copy",
            access: true,
            lockedMessage: "",
          })}

          {renderExportButton({
            icon: <FileText size={18} />,
            title: "Notes PDF",
            desc: "Clean revision PDF",
            access: true,
            lockedMessage: "",
          })}

          {renderExportButton({
            icon: <HelpCircle size={18} />,
            title: "MCQ PDF",
            desc: "Practice questions",
            access: true,
            lockedMessage: "",
          })}

          {renderExportButton({
            icon: <Crown size={18} />,
            title: "Full Study Pack",
            desc: "Notes + questions + flashcards",
            access: true,
            lockedMessage: "",
          })}

          {renderExportButton({
            icon: <Crown size={18} />,
            title: "Cram Sheet",
            desc: "Last-minute exam booster",
            access: true,
            lockedMessage: "",
          })}
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    if (activePackTab === "notes") return renderNotesTab();
    if (activePackTab === "focus") return renderFocusTab();
    if (activePackTab === "practice") return renderPracticeTab();
    return renderExportTab();
  }

  return (
    <div className="dashboard-wrapper">
      <DashboardNavbar />

      <DashboardSidebar
        onNewChat={handleNewChat}
        onOpenPanel={handleOpenPanel}
        onOpenRecent={handleOpenSavedItem}
      />

      <DashboardPanel
        open={panelOpen}
        type={panelType}
        onClose={() => setPanelOpen(false)}
        onOpenItem={handleOpenSavedItem}
      />

      <main className="dashboard-content">
        <section className="prompt-area">
          <div className="usage-strip">
            <div>
              <Clock size={15} />
              <span>{plan} Plan</span>
            </div>

            <strong>{formatHours(remainingHours)} remaining today</strong>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "12px",
            }}
          >
            {plan !== "Go" && plan !== "Pro" && (
              <button
                type="button"
                disabled={isUpgrading}
                onClick={() => handleUpgradePlan("Go")}
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  padding: "10px 14px",
                  borderRadius: "999px",
                  cursor: "pointer",
                }}
              >
                {isUpgrading ? "Opening Payment..." : "Upgrade to Go ₹1"}
              </button>
            )}

            {plan !== "Pro" && (
              <button
                type="button"
                disabled={isUpgrading}
                onClick={() => handleUpgradePlan("Pro")}
                style={{
                  border: "1px solid #e50914",
                  background: "rgba(229,9,20,0.18)",
                  color: "#fff",
                  padding: "10px 14px",
                  borderRadius: "999px",
                  cursor: "pointer",
                }}
              >
                {isUpgrading ? "Opening Payment..." : "Upgrade to Pro ₹2"}
              </button>
            )}
          </div>

          <h1>What would you like to learn today?</h1>

          <p>
            {accountType === "learner"
              ? "Paste a learning video or upload a video file and generate a clean, trusted study pack."
              : "Paste a YouTube lecture or upload a video file and generate a verified exam-ready study pack."}
          </p>

          <div className="url-box">
            {inputMode === "youtube" ? (
              <input
                type="text"
                placeholder="Paste YouTube URL..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                  setPackNotice("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGenerate();
                  }
                }}
              />
            ) : (
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/*"
                onChange={(e) => {
                  setSelectedVideoFile(e.target.files?.[0] || null);
                  setError("");
                  setPackNotice("");
                }}
              />
            )}

            <button
              onClick={
                inputMode === "youtube" ? handleGenerate : handleUploadGenerate
              }
              disabled={loading}
            >
              {loading
                ? "Generating..."
                : inputMode === "youtube"
                ? "Generate"
                : "Upload & Analyze"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "14px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setInputMode("youtube");
                setError("");
                setPackNotice("");
              }}
              style={{
                border:
                  inputMode === "youtube"
                    ? "1px solid #ff2b2b"
                    : "1px solid rgba(255,255,255,0.2)",
                background:
                  inputMode === "youtube"
                    ? "rgba(255,43,43,0.15)"
                    : "rgba(255,255,255,0.06)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              YouTube URL
            </button>

            <button
              type="button"
              onClick={() => {
                setInputMode("upload");
                setError("");
                setPackNotice("");
              }}
              style={{
                border:
                  inputMode === "upload"
                    ? "1px solid #ff2b2b"
                    : "1px solid rgba(255,255,255,0.2)",
                background:
                  inputMode === "upload"
                    ? "rgba(255,43,43,0.15)"
                    : "rgba(255,255,255,0.06)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              Upload Video
            </button>
          </div>

          {selectedVideoFile && inputMode === "upload" && (
            <p
              style={{
                marginTop: "12px",
                color: "rgba(255,255,255,0.72)",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              Selected file: {selectedVideoFile.name}
            </p>
          )}

          {error && <span className="error-text">{error}</span>}

          {packNotice && (
            <div className="pack-notice" style={{ marginTop: "14px" }}>
              <Lock size={16} />
              <span>{packNotice}</span>
            </div>
          )}
        </section>

        {videoId && (
          <section className="video-frame">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube Video Preview"
              allowFullScreen
            ></iframe>
          </section>
        )}

        {loading && (
          <section className="loading-line">
            <span className="tiny-loader"></span>
            <p>
              {inputMode === "upload"
                ? "Uploading and analyzing video audio + visual frames..."
                : "Building your verified AI study pack..."}
            </p>
          </section>
        )}

        {showNotes && (
          <section className="verified-pack">
            <div className="pack-top">
              <div className="pack-heading">
                <div className="pack-kicker">
                  <ShieldCheck size={16} />
                  Trust-first study output
                </div>

                <h2>{studyPack?.title || "Verified Study Pack"}</h2>

                <p>
                  {studyPack?.source_status ||
                    "Structured notes, exam focus, practice, and exports generated from your lecture source."}
                </p>
              </div>

              <div className="pack-actions">
                <button
                  className="pack-primary-action"
                  onClick={() => setShowTutor(true)}
                >
                  <MessageCircle size={16} />
                  Ask Tutor
                </button>

                <button
                  className="pack-secondary-action"
                  onClick={() => changePackTab("export")}
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            </div>

            <div className="trust-row">
              <div className="trust-item">
                <ShieldCheck size={15} />
                <span>Lecture source based</span>
              </div>

              <div className="trust-item">
                <Clock size={15} />
                <span>{studyPack?.generated_at || "Generated now"}</span>
              </div>

              <div className="trust-item">
                <AlertTriangle size={15} />
                <span>Verify before exam</span>
              </div>

              <div className="trust-item">
                <Brain size={15} />
                <span>{studyPack?.accuracy || "AI assisted"}</span>
              </div>
            </div>

            <div className="study-tabs">
              {studyTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={
                    activePackTab === tab.id
                      ? "study-tab active-study-tab"
                      : "study-tab"
                  }
                  onClick={() => changePackTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="study-tab-content">{renderActiveTab()}</div>
          </section>
        )}

        <AITutorPanel
          open={showTutor}
          onClose={() => setShowTutor(false)}
          topic={studyPack?.title || "Uploaded Lecture"}
          notes={studyPack?.notes || []}
        />
      </main>
    </div>
  );
}

export default Dashboard;