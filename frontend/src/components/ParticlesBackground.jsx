function ParticlesBackground() {
  const particles = Array.from({ length: 26 });

  return (
    <div className="landing-particles-container">
      <div className="landing-glow glow-one"></div>
      <div className="landing-glow glow-two"></div>
      <div className="landing-glow glow-three"></div>

      <div className="light-beam beam-one"></div>
      <div className="light-beam beam-two"></div>

      {particles.map((_, index) => (
        <span
          key={index}
          className={`landing-particle particle-${index + 1}`}
        ></span>
      ))}
    </div>
  );
}

export default ParticlesBackground;