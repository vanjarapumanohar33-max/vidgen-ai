import AnimatedTitle from "./AnimatedTitle";

function HeroSection() {
  return (
    <section className="hero-section cinematic-hero">
      <div className="cinema-vignette"></div>
      <div className="cinema-red-core"></div>
      <div className="cinema-noise-layer"></div>

      <div className="hero-line line-one"></div>
      <div className="hero-line line-two"></div>
      <div className="hero-line line-three"></div>

      <div className="hero-dot dot-one"></div>
      <div className="hero-dot dot-two"></div>
      <div className="hero-dot dot-three"></div>
      <div className="hero-dot dot-four"></div>

      <div className="cinematic-beam beam-one"></div>
      <div className="cinematic-beam beam-two"></div>
      <div className="cinematic-beam beam-three"></div>

      <div className="hero-content cinematic-content">
        <div className="hero-chip cinematic-chip">
          AI-powered study workspace
        </div>

        <AnimatedTitle />

        <p className="hero-subtitle cinematic-subtitle">
          Transform YouTube lectures into verified exam-ready study material.
        </p>

        <div className="hero-feature-row cinematic-feature-row">
          <article>
            <h3>Smart Notes</h3>
          </article>

          <article>
            <h3>MCQs</h3>
          </article>

          <article>
            <h3>AI Tutor</h3>
          </article>

          <article>
            <h3>PDF Export</h3>
          </article>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;