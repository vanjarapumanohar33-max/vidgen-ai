import { useState } from "react";
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
import { exportStudyPackPDF, generateStudyPack } from "../api/vidgenApi";

import "./Dashboard.css";

function Dashboard() {
  const accountType =
    localStorage.getItem("vidgen_account_type") || "student";

  const plan = localStorage.getItem("vidgen_plan") || "Free";

  const [url, setUrl] = useState("");
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
  const [usedHours, setUsedHours] = useState(() => getUsedHoursToday());

  function getDailyLimitHours() {
    if (accountType === "student") {
      if (plan === "Go") return 10;
      if (plan === "Pro") return 16;
      return 4;
    }

    if (accountType === "learner") {
      if (plan === "Go") return 10;
      if (plan === "Pro") return 20;
      return 4;
    }

    return 4;
  }

  function getTodayKey() {
    return new Date().toISOString().split("T")[0];
  }

  function getUsedHoursToday() {
    const today = new Date().toISOString().split("T")[0];
    const savedDate = localStorage.getItem("vidgen_usage_date");

    if (savedDate !== today) {
      localStorage.setItem("vidgen_usage_date", today);
      localStorage.setItem("vidgen_used_hours", "0");
      return 0;
    }

    return Number(localStorage.getItem("vidgen_used_hours") || "0");
  }

  function updateUsedHours(videoHours) {
    const today = getTodayKey();
    const currentUsed = getUsedHoursToday();
    const updatedUsed = currentUsed + videoHours;

    localStorage.setItem("vidgen_usage_date", today);
    localStorage.setItem("vidgen_used_hours", String(updatedUsed));

    setUsedHours(updatedUsed);
  }

  function formatHours(hours) {
    const safeHours = Math.max(0, hours);
    const fullHours = Math.floor(safeHours);
    const minutes = Math.round((safeHours - fullHours) * 60);

    if (fullHours <= 0) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }

    if (minutes === 0) {
      return `${fullHours} hour${fullHours !== 1 ? "s" : ""}`;
    }

    return `${fullHours} hour${fullHours !== 1 ? "s" : ""} ${minutes} minutes`;
  }

  function getVideoId(videoUrl) {
    try {
      const cleanUrl = videoUrl.startsWith("http")
        ? videoUrl
        : `https://${videoUrl}`;

      const parsedUrl = new URL(cleanUrl);

      if (parsedUrl.hostname.includes("youtube.com")) {
        if (parsedUrl.pathname.includes("/shorts/")) {
          return parsedUrl.pathname
            .split("/shorts/")[1]
            ?.split("/")[0];
        }

        if (parsedUrl.pathname.includes("/embed/")) {
          return parsedUrl.pathname
            .split("/embed/")[1]
            ?.split("/")[0];
        }

        return parsedUrl.searchParams.get("v");
      }

      if (parsedUrl.hostname.includes("youtu.be")) {
        return parsedUrl.pathname.replace("/", "");
      }

      return null;
    } catch {
      return null;
    }
  }

  function getVideoHoursForDemo(videoUrl) {
    const hoursMatch =
      videoUrl.match(/[?&]hours=(\d+(\.\d+)?)/i) ||
      videoUrl.match(/#hours=(\d+(\.\d+)?)/i);

    if (hoursMatch) {
      return Number(hoursMatch[1]);
    }

    return 1;
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

  function getLimitErrorMessage() {
    if (plan === "Free") {
      return "You have used your free daily limit. Upgrade to Go or Pro to continue learning today.";
    }

    if (plan === "Go") {
      return "You have used today’s Go plan limit. Upgrade to Pro to continue learning today.";
    }

    return "You have used today’s Pro plan limit. Please continue again tomorrow.";
  }

  function saveToRecents(currentVideoId) {
    const oldRecents = JSON.parse(
      localStorage.getItem("vidgen_recents") || "[]"
    );

    const newRecent = {
      title: "Verified Study Pack",
      date: new Date().toLocaleString(),
      url: url,
      videoId: currentVideoId,
      plan: plan,
      accountType: accountType,
    };

    localStorage.setItem(
      "vidgen_recents",
      JSON.stringify([newRecent, ...oldRecents].slice(0, 20))
    );
  }

  async function handleGenerate() {
    const id = getVideoId(url);

    if (!id) {
      setError("Please paste a valid YouTube URL.");
      return;
    }

    const dailyLimit = getDailyLimitHours();
    const currentUsed = getUsedHoursToday();
    const remainingHours = dailyLimit - currentUsed;
    const videoHours = getVideoHoursForDemo(url);

    setUsedHours(currentUsed);

    if (remainingHours <= 0) {
      setError(getLimitErrorMessage());
      return;
    }

    if (videoHours > remainingHours) {
      setError(
        `You have only ${formatHours(
          remainingHours
        )} remaining today. Please upload a video within your remaining limit or upgrade your plan.`
      );
      return;
    }

    setError("");
    setPackNotice("");
    setVideoId(id);
    setLoading(true);
    setShowNotes(false);
    setPanelOpen(false);
    setActivePackTab("notes");

    try {
      const result = await generateStudyPack({
        videoUrl: url,
        topic: "Uploaded Lecture",
        accountType,
        plan,
      });

      setStudyPack(result.study_pack);
      updateUsedHours(videoHours);
      saveToRecents(id);
      setShowNotes(true);
    } catch (apiError) {
      setError(apiError.message || "Unable to generate study pack right now.");
    } finally {
      setLoading(false);
    }
  }

  function handleNewChat() {
    setUrl("");
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
    setVideoId(item.videoId || "");
    setShowNotes(true);
    setLoading(false);
    setError("");
    setPackNotice("");
    setPanelOpen(false);
    setActivePackTab("notes");
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
              Source based
            </span>
          </div>

          <p>
            VidGen AI converts the lecture into clear study material so the user
            can revise faster without depending on random AI answers or scattered
            YouTube notes.
          </p>
        </article>

        <article className="pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Timestamp Notes</span>
              <h3>Important points with lecture reference</h3>
            </div>
          </div>

          <div className="timeline-list">
            <div className="timeline-item">
              <span className="timestamp-chip">00:00</span>
              <p>Topic introduction and purpose of the lecture.</p>
            </div>

            <div className="timeline-item">
              <span className="timestamp-chip">02:14</span>
              <p>Main concept explained with examples.</p>
            </div>

            <div className="timeline-item">
              <span className="timestamp-chip">05:30</span>
              <p>Important definitions, steps, or formulas.</p>
            </div>
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
            <li>Important definitions</li>
            <li>Step-by-step explanation</li>
            <li>Formula or diagram areas if detected</li>
            <li>Quick revision points</li>
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

            <p>
              Instead of only summarizing, VidGen AI extracts useful takeaways,
              practical ideas, and next-step learning points from the source
              video.
            </p>
          </article>

          <article className="pack-card">
            <div className="card-top">
              <div>
                <span className="card-tag">Practical Use</span>
                <h3>Where this knowledge can be applied</h3>
              </div>
            </div>

            <ul className="clean-list">
              <li>Real-world usage of the concept</li>
              <li>Important examples from the video</li>
              <li>Follow-up topics to learn next</li>
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

          <p>
            This section turns the lecture into important questions, viva
            preparation, and quick revision points so students can prepare faster
            before exams.
          </p>
        </article>

        <article className="pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Short Answers</span>
              <h3>2-mark and quick revision questions</h3>
            </div>
          </div>

          <ul className="question-list">
            <li>Define the main concept explained in this lecture.</li>
            <li>Write two important applications.</li>
            <li>Mention one key formula or step.</li>
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
            <li>Explain the concept with neat structure.</li>
            <li>Describe working, diagram, or process if present.</li>
            <li>Compare with related concepts.</li>
          </ul>
        </article>

        <article className="pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Viva + Mistakes</span>
              <h3>Oral exam and accuracy support</h3>
            </div>
          </div>

          <ul className="question-list">
            <li>Why is this topic important?</li>
            <li>Give one practical example.</li>
            <li>Common mistakes will be highlighted here.</li>
          </ul>
        </article>

        <article className="pack-card premium-pack-card">
          <div className="card-top">
            <div>
              <span className="card-tag">Cram Sheet</span>
              <h3>Last-minute exam booster</h3>
            </div>

            <span className="source-chip">
              {hasProAccess() ? "Unlocked" : "Pro"}
            </span>
          </div>

          <p>
            A compressed final revision sheet with definitions, important
            questions, formulas, and memory triggers from the lecture.
          </p>
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
            {[1, 2, 3].map((item) => (
              <div className="mcq-preview-item" key={item}>
                <h4>
                  {item}. Which option best explains an important concept from
                  this lecture?
                </h4>

                <p>A. Basic theory</p>
                <p>B. Practical example</p>
                <p>C. Concept application</p>
                <p>D. All of the above</p>

                {hasGoAccess() ? (
                  <div className="answer-mini">
                    <CheckCircle2 size={14} />
                    Answer key included
                    {hasProAccess() && " with detailed explanation"}
                  </div>
                ) : (
                  <div className="answer-lock-inline">
                    <Lock size={14} />
                    Answer key unlocks in Go
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>

        <div className="flashcard-grid">
          <article className="flashcard">
            <span className="flashcard-label">Front</span>
            <h3>What is the main concept of this lecture?</h3>
            <p>Tap/flip style revision card for quick memory recall.</p>
          </article>

          <article className="flashcard">
            <span className="flashcard-label">Back</span>
            <h3>Lecture-based short answer</h3>
            <p>
              The answer will be generated from the video transcript and linked
              with the study pack.
            </p>
          </article>
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
      await exportStudyPackPDF({
        title: studyPack.title || "VidGen Study Pack",
        summary: studyPack.summary || "Generated VidGen AI study pack.",
        notes: studyPack.notes || [],
        examFocus: studyPack.exam_focus || [],
        questions: [
          ...(studyPack.two_mark_questions || []),
          ...(studyPack.ten_mark_questions || []),
        ],
      });
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
            ].join("\n\n");

            navigator.clipboard.writeText(copiedNotes);
            setPackNotice("Notes copied successfully.");
            return;
          }

          if (title.toLowerCase().includes("pdf") || title === "Full Study Pack" || title === "Cram Sheet") {
            handleExportPDF();
          }
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
            Free users can copy basic notes. Go unlocks useful PDF exports. Pro
            unlocks the full verified study pack for serious exam preparation.
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

          <h1>What would you like to learn today?</h1>

          <p>
            {accountType === "learner"
              ? "Paste a learning video and generate a clean, trusted study pack."
              : "Paste a YouTube lecture and generate a verified exam-ready study pack."}
          </p>

          <div className="url-box">
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

            <button onClick={handleGenerate}>Generate</button>
          </div>

          {error && <span className="error-text">{error}</span>}
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
            <p>Building your verified study pack...</p>
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
                  Structured notes, exam focus, practice, and exports generated
                  from your lecture source.
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
                <span>Timestamp-ready</span>
              </div>

              <div className="trust-item">
                <AlertTriangle size={15} />
                <span>Verify before exam</span>
              </div>

              <div className="trust-item">
                <Brain size={15} />
                <span>Tutor limited to this lecture</span>
              </div>
            </div>

            {packNotice && (
              <div className="pack-notice">
                <Lock size={16} />
                <span>{packNotice}</span>
              </div>
            )}

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