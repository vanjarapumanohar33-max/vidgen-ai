import { Link } from "react-router-dom";
import {
  ArrowRight,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

import Reveal from "./Reveal";

function FinalCTA() {
  return (
    <section className="final-cta-section">
      <Reveal>
        <div className="final-cta-card">
          <div className="final-cta-icon">
            <GraduationCap size={30} />
          </div>

          <span>
            <ShieldCheck size={15} />
            Start with a trust-first study workflow
          </span>

          <h2>Build study material from lectures, not scattered prompts.</h2>

          <p>
            VidGen AI is designed for students and learners who want faster
            revision, cleaner study packs, and lecture-based AI support.
          </p>

          <div className="final-cta-actions">
            <Link to="/signup">
              Create Free Account
              <ArrowRight size={17} />
            </Link>

            <Link to="/plans" className="secondary-final-link">
              View Plans
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default FinalCTA;