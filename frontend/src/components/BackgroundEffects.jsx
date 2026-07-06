function BackgroundEffects() {
  return (
    <div className="background-effects">
      {Array.from({ length: 35 }).map(
        (_, index) => (
          <div
            key={index}
            className="particle"
            style={{
              left: `${(index * 11) % 100}%`,
              animationDelay: `${(index * 0.7) % 10}s`,
              animationDuration: `${8 + (index % 8)}s`,
            }}
          />
        )
      )}
    </div>
  );
}

export default BackgroundEffects;