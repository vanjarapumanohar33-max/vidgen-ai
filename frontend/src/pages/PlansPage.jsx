import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Lock,
  ShieldCheck,
  Zap,
} from "lucide-react";

import {
  getUsageStatus,
  getUserPlan,
  upgradePlanWithRazorpay,
} from "../api/vidgenApi";

function PlansPage() {
  const navigate = useNavigate();

  const [currentPlan, setCurrentPlan] = useState(
    localStorage.getItem("vidgen_plan") || "Free"
  );
  const [usageStatus, setUsageStatus] = useState(null);
  const [upgradingPlan, setUpgradingPlan] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPlan() {
      try {
        const planData = await getUserPlan();
        const backendPlan =
          planData?.plan || localStorage.getItem("vidgen_plan") || "Free";

        setCurrentPlan(backendPlan);
        localStorage.setItem("vidgen_plan", backendPlan);

        const status = await getUsageStatus(backendPlan);
        setUsageStatus(status || null);
      } catch {
        const fallbackPlan = localStorage.getItem("vidgen_plan") || "Free";
        setCurrentPlan(fallbackPlan);
      }
    }

    loadPlan();
  }, []);

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

    if (fullHours <= 0) return `${minutes} min`;
    if (minutes === 0) return `${fullHours} hr`;
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
      // Keep current state.
    }
  }

  async function handleUpgrade(targetPlan) {
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
        navigate("/dashboard");
      }, 900);
    } catch (upgradeError) {
      setError(upgradeError.message || "Payment failed or cancelled.");
    } finally {
      setUpgradingPlan("");
    }
  }

  function getButtonText(planName) {
    if (planName === "Free") {
      return currentPlan === "Free" ? "Current Plan" : "Free Included";
    }

    if (planName === "Go") {
      if (currentPlan === "Go") return "Current Plan";
      if (currentPlan === "Pro") return "Included in Pro";
      return upgradingPlan === "Go" ? "Opening Payment..." : "Choose Go ₹1";
    }

    if (planName === "Pro") {
      if (currentPlan === "Pro") return "Current Plan";
      return upgradingPlan === "Pro" ? "Opening Payment..." : "Choose Pro ₹2";
    }

    return "Choose Plan";
  }

  function isButtonDisabled(planName) {
    if (upgradingPlan) return true;
    if (planName === "Free") return true;
    if (planName === currentPlan) return true;
    if (currentPlan === "Pro" && planName === "Go") return true;
    return false;
  }

  const usedHours = Number(usageStatus?.used_hours || 0);
  const limitHours = Number(
    usageStatus?.limit_hours || getPlanLimit(currentPlan)
  );
  const remainingHours = Math.max(limitHours - usedHours, 0);

  const plans = [
    {
      name: "Free",
      title: "Basic Study Pack",
      icon: <ShieldCheck size={24} />,
      price: "₹0",
      period: "forever",
      badge: "Start here",
      description:
        "Start learning with basic lecture notes and limited practice.",
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
      title: "Serious Daily Study",
      icon: <Zap size={24} />,
      price: "₹1",
      period: "test payment",
      badge: "Best value",
      description: "Best for students who use YouTube lectures regularly.",
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
      title: "Verified Exam Booster",
      icon: <Crown size={24} />,
      price: "₹2",
      period: "test payment",
      badge: "Complete access",
      description: "For students who want complete exam-ready study material.",
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

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <span style={styles.kicker}>VidGen AI Plans</span>

        <h1 style={styles.title}>Choose the right study limit</h1>

        <p style={styles.subtitle}>
          Free starts with 4 hours daily. Go and Pro unlock more daily video
          learning time after Razorpay payment verification.
        </p>

        <div style={styles.currentCard}>
          <div>
            <span style={styles.smallText}>Current Plan</span>
            <h2 style={styles.currentPlan}>{currentPlan}</h2>
          </div>

          <div style={styles.usagePill}>
            <Clock size={16} />
            <span>
              {formatHours(remainingHours)} left out of {formatHours(limitHours)}
            </span>
          </div>
        </div>

        <div style={styles.testNotice}>
          Test mode active: Go charges ₹1 and Pro charges ₹2. Later we will
          switch backend amounts to ₹99 and ₹149.
        </div>

        {notice && <div style={styles.successNotice}>{notice}</div>}
        {error && <div style={styles.errorNotice}>{error}</div>}
      </section>

      <section style={styles.grid}>
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const disabled = isButtonDisabled(plan.name);

          return (
            <article
              key={plan.name}
              style={{
                ...styles.card,
                ...(plan.highlight ? styles.highlightCard : {}),
                ...(isCurrent ? styles.activeCard : {}),
              }}
            >
              <div style={styles.cardTop}>
                <div style={styles.iconBox}>{plan.icon}</div>
                <span style={styles.badge}>
                  {isCurrent ? "Active" : plan.badge}
                </span>
              </div>

              <h2 style={styles.planName}>{plan.name}</h2>
              <p style={styles.planTitle}>{plan.title}</p>
              <p style={styles.description}>{plan.description}</p>

              <div style={styles.priceRow}>
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
              </div>

              <div style={styles.limitBox}>
                <Clock size={15} />
                {getPlanLimit(plan.name)} hours daily video limit
              </div>

              <ul style={styles.featureList}>
                {plan.features.map((feature) => (
                  <li key={feature.text} style={styles.featureItem}>
                    {feature.enabled ? (
                      <CheckCircle2 size={16} style={styles.checkIcon} />
                    ) : (
                      <Lock size={16} style={styles.lockIcon} />
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
                onClick={() => handleUpgrade(plan.name)}
                style={{
                  ...styles.button,
                  ...(plan.name === "Go" ? styles.goButton : {}),
                  ...(plan.name === "Pro" ? styles.proButton : {}),
                  ...(disabled ? styles.disabledButton : {}),
                }}
              >
                {upgradingPlan === plan.name && (
                  <Loader2 size={16} style={styles.loader} />
                )}
                {getButtonText(plan.name)}
              </button>
            </article>
          );
        })}
      </section>

      <section style={styles.bottomActions}>
        <button style={styles.secondaryButton} onClick={() => navigate("/")}>
          Back to Home
        </button>

        <button
          style={styles.primaryButton}
          onClick={() => navigate("/dashboard")}
        >
          Go to Dashboard
        </button>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(229,9,20,0.24), transparent 34%), linear-gradient(180deg, #09090b, #000)",
    color: "#fff",
    padding: "52px 6vw",
  },
  hero: {
    maxWidth: "960px",
    margin: "0 auto 34px",
    textAlign: "center",
  },
  kicker: {
    display: "inline-flex",
    padding: "8px 13px",
    borderRadius: "999px",
    background: "rgba(229,9,20,0.16)",
    border: "1px solid rgba(229,9,20,0.35)",
    color: "#ff5656",
    fontSize: "13px",
    fontWeight: 700,
  },
  title: {
    margin: "18px 0 10px",
    fontSize: "clamp(34px, 6vw, 64px)",
    lineHeight: 1,
  },
  subtitle: {
    maxWidth: "760px",
    margin: "0 auto",
    color: "rgba(255,255,255,0.68)",
    fontSize: "17px",
    lineHeight: 1.6,
  },
  currentCard: {
    margin: "26px auto 12px",
    maxWidth: "650px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    padding: "18px",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  smallText: {
    color: "rgba(255,255,255,0.56)",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  currentPlan: {
    margin: "4px 0 0",
    fontSize: "26px",
  },
  usagePill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 13px",
    borderRadius: "999px",
    background: "rgba(0,0,0,0.3)",
    color: "rgba(255,255,255,0.82)",
  },
  testNotice: {
    maxWidth: "650px",
    margin: "12px auto",
    padding: "13px 15px",
    borderRadius: "16px",
    background: "rgba(255,193,7,0.1)",
    border: "1px solid rgba(255,193,7,0.24)",
    color: "rgba(255,255,255,0.78)",
    fontSize: "14px",
  },
  successNotice: {
    maxWidth: "650px",
    margin: "12px auto",
    padding: "13px 15px",
    borderRadius: "16px",
    background: "rgba(38,166,91,0.12)",
    border: "1px solid rgba(38,166,91,0.28)",
  },
  errorNotice: {
    maxWidth: "650px",
    margin: "12px auto",
    padding: "13px 15px",
    borderRadius: "16px",
    background: "rgba(229,9,20,0.12)",
    border: "1px solid rgba(229,9,20,0.35)",
  },
  grid: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  card: {
    padding: "22px",
    borderRadius: "26px",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.26)",
  },
  highlightCard: {
    border: "1px solid rgba(229,9,20,0.55)",
    background:
      "linear-gradient(180deg, rgba(229,9,20,0.16), rgba(255,255,255,0.055))",
  },
  activeCard: {
    outline: "2px solid rgba(255,255,255,0.18)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
  },
  iconBox: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    display: "grid",
    placeItems: "center",
    background: "rgba(229,9,20,0.15)",
    color: "#ff4d4d",
  },
  badge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.78)",
    fontSize: "12px",
  },
  planName: {
    margin: "18px 0 4px",
    fontSize: "30px",
  },
  planTitle: {
    margin: 0,
    color: "rgba(255,255,255,0.7)",
  },
  description: {
    minHeight: "48px",
    color: "rgba(255,255,255,0.62)",
    lineHeight: 1.5,
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "9px",
    margin: "18px 0 12px",
  },
  limitBox: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "8px 11px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.82)",
    fontSize: "13px",
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "18px 0",
    display: "grid",
    gap: "11px",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontSize: "14px",
  },
  checkIcon: {
    color: "#46d879",
    flexShrink: 0,
  },
  lockIcon: {
    color: "rgba(255,255,255,0.35)",
    flexShrink: 0,
  },
  button: {
    width: "100%",
    minHeight: "46px",
    borderRadius: "15px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  goButton: {
    background: "rgba(255,255,255,0.11)",
  },
  proButton: {
    background: "linear-gradient(135deg, #e50914, #8b0008)",
    border: "1px solid rgba(229,9,20,0.7)",
  },
  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  loader: {
    animation: "spin 1s linear infinite",
  },
  bottomActions: {
    maxWidth: "1180px",
    margin: "26px auto 0",
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "999px",
    background: "#e50914",
    color: "#fff",
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
};

export default PlansPage;