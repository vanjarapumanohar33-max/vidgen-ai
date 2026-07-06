import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Lock,
  FileText,
  Brain,
} from "lucide-react";

import "./PlansPage.css";

function PlansPage() {
  const navigate = useNavigate();

  const savedAccountType =
    localStorage.getItem("vidgen_account_type") || "student";

  const [accountType, setAccountType] = useState(savedAccountType);

  const plans = {
    student: [
      {
        name: "Free",
        price: "₹0",
        label: "Basic Study Pack",
        dailyHours: 4,
        bestFor: "Trying VidGen AI",
        highlight: false,
        type: "free",
        description:
          "Start learning with basic lecture notes and limited practice.",
        features: [
          "4 hours daily video limit",
          "Basic lecture overview",
          "Limited study notes",
          "5 MCQs preview",
          "Copy notes only",
        ],
        locked: [
          "PDF export",
          "Detailed answers",
          "Full cram sheet",
          "Full verified study pack",
        ],
      },
      {
        name: "Go",
        price: "₹99",
        label: "Serious Daily Study",
        dailyHours: 10,
        bestFor: "Daily college study",
        highlight: true,
        type: "paid",
        description:
          "Best for students who use YouTube lectures regularly for revision.",
        features: [
          "10 hours daily video limit",
          "Clean study notes",
          "Exam focus section",
          "10 MCQs with answer key",
          "Notes PDF export",
          "MCQ PDF export",
        ],
        locked: [
          "Full study pack export",
          "Cram sheet PDF",
          "Detailed MCQ explanations",
        ],
      },
      {
        name: "Pro",
        price: "₹149",
        label: "Verified Exam Booster",
        dailyHours: 16,
        bestFor: "Exam preparation",
        highlight: false,
        type: "paid",
        description:
          "For students who want complete exam-ready study material.",
        features: [
          "16 hours daily video limit",
          "Verified study pack",
          "Timestamp-ready notes",
          "Important 2-mark questions",
          "Important 10-mark questions",
          "Viva questions",
          "25 MCQs with explanations",
          "Flashcards",
          "Cram sheet PDF",
          "Full study pack PDF",
        ],
        locked: [],
      },
    ],

    learner: [
      {
        name: "Free",
        price: "₹0",
        label: "Basic Learning Pack",
        dailyHours: 4,
        bestFor: "Trying VidGen AI",
        highlight: false,
        type: "free",
        description:
          "Start with basic summaries and limited learning support.",
        features: [
          "4 hours daily video limit",
          "Basic learning summary",
          "Limited key insights",
          "5 MCQs preview",
          "Copy notes only",
        ],
        locked: [
          "PDF export",
          "Deep insights",
          "Full learning pack",
          "Flashcard export",
        ],
      },
      {
        name: "Go",
        price: "₹169",
        label: "Focused Learning",
        dailyHours: 10,
        bestFor: "Regular learners",
        highlight: true,
        type: "paid",
        description:
          "For learners who watch educational videos, tutorials, and long lessons.",
        features: [
          "10 hours daily video limit",
          "Clean learning notes",
          "Key insights",
          "Practical use section",
          "10 MCQs with answer key",
          "Notes PDF export",
          "MCQ PDF export",
        ],
        locked: [
          "Deep insight mode",
          "Full study pack export",
          "Flashcard PDF",
        ],
      },
      {
        name: "Pro",
        price: "₹239",
        label: "Deep Learning Pack",
        dailyHours: 20,
        bestFor: "Power learners",
        highlight: false,
        type: "paid",
        description:
          "For serious learners who want detailed insights and reusable study material.",
        features: [
          "20 hours daily video limit",
          "Full verified learning pack",
          "Timestamp-ready notes",
          "Deep insight mode",
          "Practical action steps",
          "25 MCQs with explanations",
          "Flashcards",
          "Full PDF export",
          "Learning pack download",
        ],
        locked: [],
      },
    ],
  };

  function handlePlan(plan) {
    localStorage.setItem("vidgen_account_type", accountType);

    if (plan.type === "free") {
      localStorage.setItem("vidgen_plan", "Free");
      localStorage.setItem("vidgen_daily_hours", String(plan.dailyHours));
      navigate("/dashboard");
      return;
    }

    navigate("/payment", {
      state: {
        selectedPlan: plan,
        accountType,
      },
    });
  }

  const currentPlans = plans[accountType];

  return (
    <main className="plans-page">
      <section className="plans-hero">
        <div className="plans-kicker">
          <ShieldCheck size={16} />
          Transparent pricing
        </div>

        <h1>Choose your VidGen AI study plan</h1>

        <p>
          Free users get real value. Paid plans unlock serious study workflow,
          verified study packs, PDF exports, and better practice tools.
        </p>

        <div className="account-switch">
          <button
            className={accountType === "student" ? "active-account" : ""}
            onClick={() => setAccountType("student")}
          >
            <GraduationCap size={17} />
            Student
          </button>

          <button
            className={accountType === "learner" ? "active-account" : ""}
            onClick={() => setAccountType("learner")}
          >
            <Sparkles size={17} />
            Learner
          </button>
        </div>
      </section>

      <section className="pricing-grid">
        {currentPlans.map((plan) => (
          <article
            className={
              plan.highlight ? "pricing-card highlighted-plan" : "pricing-card"
            }
            key={plan.name}
          >
            {plan.highlight && (
              <div className="popular-chip">
                <Crown size={14} />
                Best value
              </div>
            )}

            <div className="plan-head">
              <div>
                <span>{plan.label}</span>
                <h2>{plan.name}</h2>
              </div>

              <div className="plan-icon">
                {plan.name === "Pro" ? (
                  <Crown size={22} />
                ) : plan.name === "Go" ? (
                  <Brain size={22} />
                ) : (
                  <FileText size={22} />
                )}
              </div>
            </div>

            <p className="plan-description">{plan.description}</p>

            <div className="price-row">
              <strong>{plan.price}</strong>
              <span>{plan.price === "₹0" ? "forever" : "/ month"}</span>
            </div>

            <div className="daily-limit">
              <Clock size={15} />
              <span>{plan.dailyHours} hours daily video limit</span>
            </div>

            <div className="best-for-box">
              Best for: <strong>{plan.bestFor}</strong>
            </div>

            <div className="feature-list">
              {plan.features.map((feature) => (
                <div className="feature-item" key={feature}>
                  <CheckCircle2 size={16} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {plan.locked.length > 0 && (
              <div className="locked-list">
                {plan.locked.map((item) => (
                  <div className="locked-item" key={item}>
                    <Lock size={15} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              className={plan.highlight ? "plan-btn main-plan-btn" : "plan-btn"}
              onClick={() => handlePlan(plan)}
            >
              {plan.type === "free" ? "Continue Free" : `Choose ${plan.name}`}
              <ArrowRight size={17} />
            </button>
          </article>
        ))}
      </section>

      <section className="pricing-trust-section">
        <div>
          <ShieldCheck size={20} />
          <h3>No hidden paywall feeling</h3>
          <p>
            Users should clearly understand what is free, what is paid, and why
            upgrading is useful.
          </p>
        </div>

        <div>
          <GraduationCap size={20} />
          <h3>Exam-ready value</h3>
          <p>
            Paid plans unlock study outputs that help with revision, MCQs, viva,
            PDFs, and cram sheets.
          </p>
        </div>

        <div>
          <Clock size={20} />
          <h3>Daily learning limits</h3>
          <p>
            Plans are based on practical daily usage, so students can choose
            based on their real learning routine.
          </p>
        </div>
      </section>
    </main>
  );
}

export default PlansPage;