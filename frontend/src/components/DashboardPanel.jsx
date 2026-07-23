import { useEffect, useMemo, useState } from "react";
import {
  X,
  Clock,
  Crown,
  CheckCircle2,
  Lock,
  Sparkles,
  BookOpen,
  HelpCircle,
  FileText,
  User,
  History,
  CreditCard,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import {
  getUsageStatus,
  getUserPlan,
  upgradePlanWithRazorpay,
} from "../api/vidgenApi";

function DashboardPanel({ open, type, onClose, onOpenItem }) {
  const [currentPlan, setCurrentPlan] = useState(
    localStorage.getItem("vidgen_plan") || "Free"
  );
  const [usageStatus, setUsageStatus] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [upgradingPlan, setUpgradingPlan] = useState("");

  const normalizedType = String(type || "workspace").toLowerCase();

  const recents = useMemo(() => {
    if (!open) return [];

    try {
      return JSON.parse(localStorage.getItem("vidgen_recents") || "[]");
    } catch {
      return [];
    }
  }, [open]);

  const panelMeta = useMemo(() => {
    const meta = {
      workspace: {
        title: "Workspace",
        subtitle: "Your recent VidGen AI activity.",
        icon: <History size={18} />,
      },
      "study-pack": {
        title: "Study Pack",
        subtitle: "Notes, exam focus, practice and exports.",
        icon: <BookOpen size={18} />,
      },
      study: {
        title: "Study Pack",
        subtitle: "Notes, exam focus, practice and exports.",
        icon: <BookOpen size={18} />,
      },
      practice: {
        title: "Practice",
        subtitle: "MCQs, flashcards and revision support.",
        icon: <HelpCircle size={18} />,
      },
      tutor: {
        title: "AI Tutor",
        subtitle: "Ask questions from your generated study pack.",
        icon: <Sparkles size={18} />,
      },
      plans: {
        title: "Plans",
        subtitle: "Upgrade your daily video limit and study features.",
        icon: <Crown size={18} />,
      },
      profile: {
        title: "Profile",
        subtitle: "Your VidGen AI account details.",
        icon: <User size={18} />,
      },
    };

    return meta[normalizedType] || meta.workspace;
  }, [normalizedType]);

  useEffect(() => {
    if (!open) return;

    async function loadPlanAndUsage() {
      try {
        const planData = await getUserPlan();
        const backendPlan =
          planData?.plan || localStorage.getItem("vidgen_plan") || "Free";

        setCurrentPlan(backendPlan);
        localStorage.setItem("vidgen_plan", backendPlan);

        const status = await getUsageStatus(backendPlan);
        setUsageStatus(status || null);
      } catch {
        setUsageStatus(null);
      }
    }

    loadPlanAndUsage();
  }, [open, normalizedType]);

  function getPlanLimit(plan) {
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
      return `${minutes} min`;
    }

    if (minutes === 0) {
      return `${fullHours} hr`;
    }

    return `${fullHours} hr ${minutes} min`;
  }

  async function refreshUsage(planName) {
    try {
      const status = await getUsageStatus(planName);
      setUsageStatus(status || null);

      if (status?.plan) {
        setCurrentPlan(status.plan);
        localStorage.setItem("vidgen_plan", status.plan);
      }
    } catch {
      // Keep current UI state.
    }
  }

  async function handleUpgradePlan(targetPlan) {
    try {
      setNotice("");
      setError("");
      setUpgradingPlan(targetPlan);

      const result = await upgradePlanWithRazorpay(targetPlan);

      if (!result?.success) {
        throw new Error("Payment verification failed.");
      }

      const upgradedPlan = result?.plan || targetPlan;

      setCurrentPlan(upgradedPlan);
      localStorage.setItem("vidgen_plan", upgradedPlan);

      await refreshUsage(upgradedPlan);

      setNotice(`${upgradedPlan} plan activated successfully.`);

      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (upgradeError) {
      setError(upgradeError.message || "Payment failed or cancelled.");
    } finally {
      setUpgradingPlan("");
    }
  }

  function getPlanButton(cardPlan) {
    if (cardPlan === "Free") {
      if (currentPlan === "Free") return "Current Plan";
      return "Free Plan";
    }

    if (cardPlan === "Go") {
      if (currentPlan === "Go") return "Current Plan";
      if (currentPlan === "Pro") return "Included in Pro";
      return upgradingPlan === "Go" ? "Opening Payment..." : "Choose Go ₹1";
    }

    if (cardPlan === "Pro") {
      if (currentPlan === "Pro") return "Current Plan";
      return upgradingPlan === "Pro" ? "Opening Payment..." : "Choose Pro ₹2";
    }

    return "Choose Plan";
  }

  function isPlanButtonDisabled(cardPlan) {
    if (upgradingPlan) return true;
    if (cardPlan === "Free") return true;
    if (cardPlan === currentPlan) return true;
    if (currentPlan === "Pro" && cardPlan === "Go") return true;
    return false;
  }

  const plans = [
    {
      name: "Free",
      label: "Basic Study Pack",
      price: "₹0",
      period: "forever",
      badge: "Start here",
      dailyLimit: "4 hours daily video limit",
      bestFor: "Trying VidGen AI",
      description:
        "Start learning with basic lecture notes and limited practice.",
      highlight: false,
      features: [
        { text: "4 hours daily video limit", enabled: true },
        { text: "Basic lecture overview", enabled: true },
        { text: "Limited study notes", enabled: true },
        { text: "5 MCQs preview", enabled: true },
        { text: "Copy notes", enabled: true },
        { text: "Notes PDF export", enabled: true },
        { text: "Detailed MCQ explanations", enabled: false },
        { text: "Full cram sheet", enabled: false },
        { text: "Full verified study pack", enabled: false },
      ],
    },
    {
      name: "Go",
      label: "Serious Daily Study",
      price: "₹1",
      period: "test payment",
      badge: "Best value",
      dailyLimit: "10 hours daily video limit",
      bestFor: "Daily college study",
      description:
        "Best for students who use YouTube lectures regularly for revision.",
      highlight: true,
      features: [
        { text: "10 hours daily video limit", enabled: true },
        { text: "Clean study notes", enabled: true },
        { text: "Exam focus section", enabled: true },
        { text: "10 MCQs with answer key", enabled: true },
        { text: "Notes PDF export", enabled: true },
        { text: "MCQ PDF export", enabled: true },
        { text: "Full study pack export", enabled: true },
        { text: "Detailed MCQ explanations", enabled: false },
        { text: "Advanced Pro cram sheet", enabled: false },
      ],
    },
    {
      name: "Pro",
      label: "Verified Exam Booster",
      price: "₹2",
      period: "test payment",
      badge: "Complete access",
      dailyLimit: "16 hours daily video limit",
      bestFor: "Exam preparation",
      description:
        "For students who want complete exam-ready study material.",
      highlight: false,
      features: [
        { text: "16 hours daily video limit", enabled: true },
        { text: "Verified study pack", enabled: true },
        { text: "Timestamp-ready notes", enabled: true },
        { text: "Important 2-mark questions", enabled: true },
        { text: "Important 10-mark questions", enabled: true },
        { text: "Viva questions", enabled: true },
        { text: "25 MCQs with explanations", enabled: true },
        { text: "Flashcards", enabled: true },
        { text: "Cram sheet PDF", enabled: true },
        { text: "Full study pack PDF", enabled: true },
      ],
    },
  ];

  function renderPlans() {
    const usedHours = Number(usageStatus?.used_hours || 0);
    const limitHours = Number(
      usageStatus?.limit_hours || getPlanLimit(currentPlan)
    );
    const remainingHours = Math.max(limitHours - usedHours, 0);

    return (
      <div style={styles.panelBody}>
        <div style={styles.usageCard}>
          <div>
            <span style={styles.miniLabel}>Current Plan</span>
            <h3 style={styles.currentPlanTitle}>{currentPlan}</h3>
          </div>

          <div style={styles.usageRight}>
            <Clock size={16} />
            <span>
              {formatHours(remainingHours)} left out of {formatHours(limitHours)}
            </span>
          </div>
        </div>

        <div style={styles.testNotice}>
          <AlertTriangle size={16} />
          <span>
            Razorpay is connected in test mode now. Go charges ₹1 and Pro
            charges ₹2 for testing. Later we will switch to ₹99 and ₹149.
          </span>
        </div>

        {notice && (
          <div style={styles.successNotice}>
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div style={styles.errorNotice}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={styles.planGrid}>
          {plans.map((planCard) => {
            const isCurrent = currentPlan === planCard.name;
            const disabled = isPlanButtonDisabled(planCard.name);

            return (
              <article
                key={planCard.name}
                style={{
                  ...styles.planCard,
                  ...(planCard.highlight ? styles.highlightPlan : {}),
                  ...(isCurrent ? styles.currentPlanCard : {}),
                }}
              >
                <div style={styles.planTop}>
                  <div>
                    <span style={styles.planLabel}>{planCard.label}</span>
                    <h3 style={styles.planName}>{planCard.name}</h3>
                  </div>

                  <span
                    style={{
                      ...styles.badge,
                      ...(planCard.highlight ? styles.redBadge : {}),
                    }}
                  >
                    {isCurrent ? "Active" : planCard.badge}
                  </span>
                </div>

                <p style={styles.planDescription}>{planCard.description}</p>

                <div style={styles.priceRow}>
                  <strong>{planCard.price}</strong>
                  <span>{planCard.period}</span>
                </div>

                <div style={styles.limitPill}>
                  <Clock size={14} />
                  {planCard.dailyLimit}
                </div>

                <p style={styles.bestFor}>
                  <strong>Best for:</strong> {planCard.bestFor}
                </p>

                <ul style={styles.featureList}>
                  {planCard.features.map((feature) => (
                    <li key={feature.text} style={styles.featureItem}>
                      {feature.enabled ? (
                        <CheckCircle2 size={15} style={styles.enabledIcon} />
                      ) : (
                        <Lock size={15} style={styles.lockedIcon} />
                      )}

                      <span
                        style={{
                          color: feature.enabled
                            ? "rgba(255,255,255,0.86)"
                            : "rgba(255,255,255,0.42)",
                        }}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleUpgradePlan(planCard.name)}
                  style={{
                    ...styles.planButton,
                    ...(planCard.name === "Pro" ? styles.proButton : {}),
                    ...(planCard.name === "Go" ? styles.goButton : {}),
                    ...(disabled ? styles.disabledButton : {}),
                  }}
                >
                  {upgradingPlan === planCard.name && (
                    <Loader2 size={15} style={styles.spinIcon} />
                  )}
                  {getPlanButton(planCard.name)}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWorkspace() {
    return (
      <div style={styles.panelBody}>
        <div style={styles.infoCard}>
          <h3>Recent Study Packs</h3>
          <p>
            Your recently generated packs will appear here. Click any item to
            reopen it in the dashboard.
          </p>
        </div>

        {recents.length === 0 ? (
          <div style={styles.emptyBox}>
            <History size={22} />
            <p>No recent study packs yet.</p>
          </div>
        ) : (
          <div style={styles.recentList}>
            {recents.slice(0, 10).map((item) => (
              <button
                key={item.id}
                type="button"
                style={styles.recentItem}
                onClick={() => {
                  if (onOpenItem) onOpenItem(item);
                  if (onClose) onClose();
                }}
              >
                <div>
                  <strong>{item.title || "Study Pack"}</strong>
                  <span>{item.date || "Recently generated"}</span>
                </div>

                <BookOpen size={16} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderStudyPack() {
    return (
      <div style={styles.panelBody}>
        <div style={styles.infoCard}>
          <BookOpen size={24} />
          <h3>Study Pack</h3>
          <p>
            Generate a lecture pack from the dashboard to view smart notes,
            summary, exam focus, practice questions and PDF export options.
          </p>
        </div>

        <div style={styles.featureGrid}>
          <FeatureBox
            icon={<FileText />}
            title="Smart Notes"
            text="Clean revision notes from lecture content."
          />
          <FeatureBox
            icon={<HelpCircle />}
            title="Practice"
            text="MCQs, flashcards and exam questions."
          />
          <FeatureBox
            icon={<CreditCard />}
            title="Export"
            text="Download useful PDFs for revision."
          />
        </div>
      </div>
    );
  }

  function renderPractice() {
    return (
      <div style={styles.panelBody}>
        <div style={styles.infoCard}>
          <HelpCircle size={24} />
          <h3>Practice Mode</h3>
          <p>
            Practice questions are generated after a study pack is created. Go
            and Pro plans unlock stronger practice support.
          </p>
        </div>

        <div style={styles.featureGrid}>
          <FeatureBox
            icon={<CheckCircle2 />}
            title="Free"
            text="5 MCQ preview."
          />
          <FeatureBox
            icon={<Crown />}
            title="Go"
            text="10 MCQs with answer key."
          />
          <FeatureBox
            icon={<Sparkles />}
            title="Pro"
            text="25 MCQs with explanations and flashcards."
          />
        </div>
      </div>
    );
  }

  function renderTutor() {
    return (
      <div style={styles.panelBody}>
        <div style={styles.infoCard}>
          <Sparkles size={24} />
          <h3>AI Tutor</h3>
          <p>
            Open AI Tutor after generating a study pack. It answers based on your
            generated notes, not random unrelated content.
          </p>
        </div>
      </div>
    );
  }

  function renderProfile() {
    const accountType =
      localStorage.getItem("vidgen_account_type") || "student";

    return (
      <div style={styles.panelBody}>
        <div style={styles.profileCard}>
          <div style={styles.avatarCircle}>
            <User size={28} />
          </div>

          <div>
            <h3>VidGen AI User</h3>
            <p>
              {accountType === "student"
                ? "Student account"
                : "Learner account"}
            </p>
          </div>
        </div>

        <div style={styles.infoCard}>
          <h3>Account Status</h3>
          <p>
            Current plan: <strong>{currentPlan}</strong>
          </p>
          <p>
            Daily video limit: <strong>{getPlanLimit(currentPlan)} hours</strong>
          </p>
        </div>
      </div>
    );
  }

  function renderContent() {
    if (normalizedType === "plans") return renderPlans();
    if (normalizedType === "study" || normalizedType === "study-pack") {
      return renderStudyPack();
    }
    if (normalizedType === "practice") return renderPractice();
    if (normalizedType === "tutor") return renderTutor();
    if (normalizedType === "profile") return renderProfile();

    return renderWorkspace();
  }

  if (!open) return null;

  return (
    <aside style={styles.overlay}>
      <div style={styles.backdrop} onClick={onClose}></div>

      <section style={styles.panel}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerIcon}>{panelMeta.icon}</span>

            <div>
              <h2>{panelMeta.title}</h2>
              <p>{panelMeta.subtitle}</p>
            </div>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            <X size={20} />
          </button>
        </header>

        {renderContent()}
      </section>
    </aside>
  );
}

function FeatureBox({ icon, title, text }) {
  return (
    <div style={styles.featureBox}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    pointerEvents: "auto",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.62)",
    backdropFilter: "blur(8px)",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "min(1080px, 94vw)",
    height: "100vh",
    overflowY: "auto",
    background:
      "linear-gradient(180deg, rgba(20,20,24,0.98), rgba(7,7,9,0.98))",
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "-30px 0 80px rgba(0,0,0,0.55)",
    color: "#fff",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 3,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "24px 28px",
    background: "rgba(10,10,12,0.9)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(14px)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  headerIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "16px",
    display: "grid",
    placeItems: "center",
    background: "rgba(229,9,20,0.16)",
    color: "#ff4141",
    border: "1px solid rgba(229,9,20,0.35)",
  },
  closeButton: {
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  panelBody: {
    padding: "26px 28px 42px",
  },
  usageCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "18px",
    borderRadius: "22px",
    background:
      "linear-gradient(135deg, rgba(229,9,20,0.16), rgba(255,255,255,0.05))",
    border: "1px solid rgba(255,255,255,0.1)",
    marginBottom: "16px",
  },
  miniLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  currentPlanTitle: {
    margin: "4px 0 0",
    fontSize: "28px",
  },
  usageRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 13px",
    borderRadius: "999px",
    background: "rgba(0,0,0,0.28)",
    color: "rgba(255,255,255,0.86)",
    fontSize: "14px",
  },
  testNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "rgba(255,193,7,0.1)",
    border: "1px solid rgba(255,193,7,0.24)",
    color: "rgba(255,255,255,0.82)",
    marginBottom: "16px",
    fontSize: "14px",
  },
  successNotice: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    padding: "13px 15px",
    borderRadius: "14px",
    background: "rgba(38,166,91,0.12)",
    border: "1px solid rgba(38,166,91,0.28)",
    marginBottom: "16px",
  },
  errorNotice: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    padding: "13px 15px",
    borderRadius: "14px",
    background: "rgba(229,9,20,0.12)",
    border: "1px solid rgba(229,9,20,0.35)",
    marginBottom: "16px",
  },
  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
  },
  planCard: {
    position: "relative",
    padding: "20px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.24)",
  },
  highlightPlan: {
    border: "1px solid rgba(229,9,20,0.55)",
    background:
      "linear-gradient(180deg, rgba(229,9,20,0.14), rgba(255,255,255,0.055))",
  },
  currentPlanCard: {
    outline: "2px solid rgba(255,255,255,0.18)",
  },
  planTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
  },
  planLabel: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.6)",
  },
  planName: {
    margin: "4px 0 0",
    fontSize: "26px",
  },
  badge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.76)",
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  redBadge: {
    background: "rgba(229,9,20,0.2)",
    color: "#ff6b6b",
  },
  planDescription: {
    minHeight: "46px",
    color: "rgba(255,255,255,0.68)",
    lineHeight: 1.5,
    margin: "14px 0",
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    marginBottom: "12px",
  },
  limitPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "8px 11px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.82)",
    fontSize: "13px",
  },
  bestFor: {
    color: "rgba(255,255,255,0.68)",
    fontSize: "14px",
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "16px 0 18px",
    display: "grid",
    gap: "10px",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontSize: "14px",
  },
  enabledIcon: {
    color: "#46d879",
    flexShrink: 0,
  },
  lockedIcon: {
    color: "rgba(255,255,255,0.36)",
    flexShrink: 0,
  },
  planButton: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  goButton: {
    background: "rgba(255,255,255,0.1)",
  },
  proButton: {
    background: "linear-gradient(135deg, #e50914, #8b0008)",
    border: "1px solid rgba(229,9,20,0.7)",
  },
  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  spinIcon: {
    animation: "spin 1s linear infinite",
  },
  infoCard: {
    padding: "20px",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
    marginBottom: "16px",
  },
  emptyBox: {
    minHeight: "180px",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    color: "rgba(255,255,255,0.62)",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.04)",
    border: "1px dashed rgba(255,255,255,0.12)",
  },
  recentList: {
    display: "grid",
    gap: "12px",
  },
  recentItem: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.055)",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  featureBox: {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "20px",
    borderRadius: "22px",
    background:
      "linear-gradient(135deg, rgba(229,9,20,0.14), rgba(255,255,255,0.05))",
    border: "1px solid rgba(255,255,255,0.1)",
    marginBottom: "16px",
  },
  avatarCircle: {
    width: "58px",
    height: "58px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.08)",
  },
};

export default DashboardPanel;