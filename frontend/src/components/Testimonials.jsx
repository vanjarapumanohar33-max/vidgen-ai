import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  IndianRupee,
  ShieldCheck,
  Target,
} from "lucide-react";

import Reveal from "./Reveal";

function Testimonials() {
  const insights = [
    {
      icon: <Clock size={22} />,
      title: "Students pay for time saved",
      text:
        "The product should clearly show how it reduces long lecture watching into faster revision.",
    },
    {
      icon: <ShieldCheck size={22} />,
      title: "Trust is the main differentiator",
      text:
        "Users worry about wrong AI output, so source-grounding and verify labels must be visible.",
    },
    {
      icon: <Target size={22} />,
      title: "Exam utility beats generic summaries",
      text:
        "The strongest student value is notes, important questions, MCQs, viva, and cram sheets.",
    },
    {
      icon: <IndianRupee size={22} />,
      title: "Pricing must feel honest",
      text:
        "Free should be useful, Go should feel affordable, and Pro should feel like a real exam booster.",
    },
  ];

  return (
    <section className="validation-section">
      <Reveal>
        <div className="section-heading">
          <span>Validation-backed direction</span>

          <h2>What we must never forget while building</h2>

          <p>
            Our UI should always remind users that VidGen AI is focused on
            reliable study material, not just attractive AI text.
          </p>
        </div>
      </Reveal>

      <div className="validation-grid">
        {insights.map((item, index) => (
          <Reveal key={item.title} delay={index * 80}>
            <article className="validation-card">
              <div>{item.icon}</div>

              <h3>{item.title}</h3>

              <p>{item.text}</p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="validation-warning-box">
          <AlertTriangle size={20} />

          <div>
            <h3>Our internal rule</h3>

            <p>
              Before adding any feature, check whether it improves trust, saves
              time, helps revision, or makes payment feel worth it.
            </p>
          </div>

          <CheckCircle2 size={20} />
        </div>
      </Reveal>
    </section>
  );
}

export default Testimonials;