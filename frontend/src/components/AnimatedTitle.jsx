function AnimatedTitle() {
  const letters = ["V", "I", "D", "G", "E", "N"];
  const aiLetters = ["A", "I"];

  return (
    <div className="title-stage">
      <h1 className="title-word" aria-label="VIDGEN AI">
        <span className="main-title-word">
          {letters.map((letter, index) => (
            <span
              className="title-letter"
              style={{ "--delay": `${index * 0.07}s` }}
              key={letter + index}
            >
              {letter}
            </span>
          ))}
        </span>

        <span className="ai-title-word">
          {aiLetters.map((letter, index) => (
            <span
              className="title-letter ai-letter"
              style={{ "--delay": `${0.45 + index * 0.08}s` }}
              key={letter + index}
            >
              {letter}
            </span>
          ))}
        </span>
      </h1>

      <div className="title-lock-line"></div>
    </div>
  );
}

export default AnimatedTitle;