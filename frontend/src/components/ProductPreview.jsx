import {
  AlertTriangle,
  Brain,
  Clock,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";

import Reveal from "./Reveal";

function ProductPreview() {
  return (
    <section className="product-preview-section">
      <Reveal>
        <div className="section-heading">
          <span>Product experience</span>

          <h2>A dashboard that feels made for studying</h2>

          <p>
            The generated output should feel like a complete study workspace,
            not a long block of AI text.
          </p>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="preview-window">
          <div className="preview-header">
            <div className="preview-window-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div className="preview-header-status">
              <ShieldCheck size={14} />
              Lecture source based
            </div>
          </div>

          <div className="preview-body">
            <aside className="preview-sidebar">
              <div className="preview-logo">V</div>

              <button className="active">New chat</button>
              <button>Search</button>
              <button>Pinned</button>
              <button>Library</button>

              <div className="preview-recents">
                <span>Recents</span>
                <p>Verified Study Pack</p>
                <p>Network Analysis Lecture</p>
                <p>BCME Revision</p>
              </div>
            </aside>

            <main className="preview-main">
              <div className="preview-pack-top">
                <div>
                  <span className="preview-kicker">
                    <ShieldCheck size={14} />
                    Trust-first study output
                  </span>

                  <h3>Verified Study Pack</h3>

                  <p>
                    Structured notes, exam focus, practice, and exports from
                    the lecture source.
                  </p>
                </div>

                <div className="preview-actions">
                  <button>
                    <Brain size={15} />
                    Ask Tutor
                  </button>

                  <button>
                    <Download size={15} />
                    Export
                  </button>
                </div>
              </div>

              <div className="preview-trust-row">
                <span>
                  <ShieldCheck size={13} />
                  Source based
                </span>

                <span>
                  <Clock size={13} />
                  Timestamp-ready
                </span>

                <span>
                  <AlertTriangle size={13} />
                  Verify before exam
                </span>
              </div>

              <div className="preview-tabs">
                <button className="active">
                  <FileText size={14} />
                  Study Notes
                </button>

                <button>
                  <GraduationCap size={14} />
                  Exam Focus
                </button>

                <button>
                  <HelpCircle size={14} />
                  Practice
                </button>

                <button>
                  <Download size={14} />
                  Export
                </button>
              </div>

              <div className="preview-output-grid">
                <div className="preview-output-card big">
                  <span>Lecture Overview</span>

                  <h4>Clean summary from uploaded lecture</h4>

                  <p>
                    VidGen AI converts a long lecture into structured revision
                    material.
                  </p>
                </div>

                <div className="preview-output-card">
                  <span>Timestamp Notes</span>

                  <h4>00:00 • Introduction</h4>

                  <p>Main topic and lecture purpose.</p>
                </div>

                <div className="preview-output-card">
                  <span>Exam Priority</span>

                  <h4>Important questions</h4>

                  <p>2-mark, 10-mark, and viva practice.</p>
                </div>
              </div>
            </main>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default ProductPreview;