import { Link } from "react-router-dom";

import HeroSection from "../components/HeroSection";
import FeaturesSection from "../components/FeaturesSection";
import HowItWorks from "../components/HowItWorks";

import "../styles/LandingPage.css";

function LandingPage() {
  const coreFeatures = [
    {
      title: "Verified Study Pack",
      text: "Convert one lecture into structured notes, key points, revision material, and exam-focused content.",
    },
    {
      title: "Timestamp-ready Notes",
      text: "Important lecture points are arranged clearly so students can revise with better context.",
    },
    {
      title: "Exam Focus Mode",
      text: "Generate short answers, long answers, viva questions, important topics, MCQs, and flashcards.",
    },
    {
      title: "Lecture AI Tutor",
      text: "Ask doubts from the selected lecture instead of getting random general answers.",
    },
    {
      title: "Practice Generator",
      text: "Create MCQs and flashcards from the lecture to test understanding before exams.",
    },
    {
      title: "PDF Export",
      text: "Download notes, practice material, and the complete study pack for offline revision.",
    },
  ];

  return (
    <main className="landing-page">
      <div className="global-particles" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, index) => (
          <span key={index}></span>
        ))}
      </div>

      <nav className="landing-navbar">
        <Link to="/" className="brand-mark">
          <span className="brand-text">
            VIDGEN <strong>AI</strong>
          </span>
        </Link>

        <div className="nav-actions">
          <Link to="/login" className="nav-link-btn">
            Login
          </Link>

          <Link to="/signup" className="nav-primary-btn">
            Get Started
          </Link>
        </div>
      </nav>

      <HeroSection />
      <FeaturesSection />
      <HowItWorks />

      <section className="launch-features-section">
        <div className="section-heading compact-heading">
          <span>Core Features</span>
          <h2>All study tools in one place.</h2>
        </div>

        <div className="launch-features-grid">
          {coreFeatures.map((feature, index) => (
            <article className="launch-feature-card" key={index}>
              <div className="launch-feature-number">
                {String(index + 1).padStart(2, "0")}
              </div>

              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="preview-section launch-dashboard-section">
        <div className="section-heading compact-heading">
          <span>Dashboard Preview</span>
          <h2>One workspace for every lecture.</h2>
        </div>

        <div className="dashboard-preview-card launch-preview-upgrade">
          <aside className="preview-sidebar">
            <div className="preview-logo">V</div>

            <button className="active">Study Pack</button>
            <button>AI Tutor</button>
            <button>Practice</button>
            <button>Exports</button>

            <div className="preview-recents">
              <span>Recents</span>
              <p>Network Analysis Lecture</p>
              <p>BCME Unit IV</p>
            </div>
          </aside>

          <div className="preview-main">
            <div className="preview-top-row">
              <div>
                <span className="preview-badge">Verified Study Pack</span>
                <h3>Lecture converted into revision material</h3>
                <p>
                  Source-based notes, exam focus, MCQs, flashcards, PDF export,
                  and lecture-limited AI Tutor.
                </p>
              </div>

              <button>Export PDF</button>
            </div>

            <div className="preview-tabs">
              <span className="active">Study Notes</span>
              <span>Exam Focus</span>
              <span>Practice</span>
              <span>Export</span>
            </div>

            <div className="preview-grid">
              <article>
                <span>01</span>
                <h4>Timestamp Notes</h4>
                <p>Important lecture points arranged clearly for revision.</p>
              </article>

              <article>
                <span>02</span>
                <h4>Exam Focus</h4>
                <p>2-mark, long answer, viva, and key topic preparation.</p>
              </article>

              <article>
                <span>03</span>
                <h4>Practice Pack</h4>
                <p>MCQs and flashcards generated from the lecture.</p>
              </article>

              <article>
                <span>04</span>
                <h4>Lecture AI Tutor</h4>
                <p>Answers doubts from the selected lecture only.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="difference-section launch-difference-section">
        <div className="section-heading">
          <span>Why Different?</span>
          <h2>Not just a summary. A complete revision workflow.</h2>
          <p>
            VidGen AI is designed for students who need organized study output,
            not only general AI answers.
          </p>
        </div>

        <div className="launch-difference-grid">
          <article>
            <span>Generic AI Tools</span>
            <h3>Manual prompting</h3>
            <p>
              Students must repeatedly ask for summaries, MCQs, notes, and exam
              answers separately.
            </p>
          </article>

          <article className="main-difference-card">
            <span>VidGen AI</span>
            <h3>One lecture. One study pack.</h3>
            <p>
              Notes, exam focus, practice, AI Tutor, and PDF export are combined
              into one student-focused workflow.
            </p>
          </article>

          <article>
            <span>Normal Summarizers</span>
            <h3>Only short output</h3>
            <p>
              Most summarizers stop at short notes and do not support deeper
              exam preparation.
            </p>
          </article>
        </div>
      </section>

      <section className="final-section launch-final-section">
        <div className="final-card launch-final-card">
          <span>Build faster. Revise smarter.</span>

          <h2>Turn every lecture into a clean study pack.</h2>

          <p>
            VidGen AI helps students save time, revise clearly, and prepare
            better with lecture-based study material.
          </p>

          <Link to="/signup">Start with VidGen AI</Link>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;