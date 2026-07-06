function FeaturesSection() {
  const problems = [
    {
      title: "Lecture Overload",
      text: "Students watch long lectures, but revision becomes difficult when important points are not organized.",
    },
    {
      title: "Scattered Material",
      text: "Notes, screenshots, YouTube links, PDFs, and AI chats often stay in different places.",
    },
    {
      title: "Exam Preparation Gap",
      text: "Students need clear notes, short answers, long answers, viva questions, and practice material.",
    },
    {
      title: "Revision Pressure",
      text: "Before exams, students need fast, reliable, and easy-to-understand material from the lecture.",
    },
  ];

  return (
    <section className="problem-section pro-problem-section">
      <div className="section-heading compact-heading">
        <span>Student Problem</span>
        <h2>From lecture overload to clear revision.</h2>
      </div>

      <div className="pro-problem-grid">
        {problems.map((item, index) => (
          <article className="pro-problem-card" key={index}>
            <div className="pro-card-glow"></div>

            <div className="pro-card-top">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div></div>
            </div>

            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default FeaturesSection;