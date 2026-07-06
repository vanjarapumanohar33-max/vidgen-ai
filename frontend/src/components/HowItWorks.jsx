function HowItWorks() {
  const steps = [
    {
      title: "Paste lecture link",
      text: "Student adds a YouTube lecture or class video link into VidGen AI.",
    },
    {
      title: "AI reads lecture",
      text: "The system understands transcript, topics, and lecture structure.",
    },
    {
      title: "Study pack generated",
      text: "Clean notes, key points, timestamps, and revision material are created.",
    },
    {
      title: "Exam focus added",
      text: "Short answers, long answers, viva questions, MCQs, and flashcards are prepared.",
    },
    {
      title: "Ask lecture tutor",
      text: "The AI Tutor answers doubts only from the selected lecture context.",
    },
    {
      title: "Export and revise",
      text: "Student downloads notes or full study pack as PDF for quick revision.",
    },
  ];

  return (
    <section className="workflow-section pro-workflow-section" id="workflow">
      <div className="section-heading">
        <span>Workflow</span>
        <h2>From lecture to revision in one clean flow.</h2>
        <p>
          VidGen AI keeps the complete process simple, focused, and
          student-friendly from input to final study material.
        </p>
      </div>

      <div className="workflow-process-grid">
        {steps.map((step, index) => (
          <article
            className="workflow-step"
            style={{ "--step-delay": `${index * 0.16}s` }}
            key={index}
          >
            <div className="workflow-node">
              {String(index + 1).padStart(2, "0")}
            </div>

            <div className="workflow-step-card">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HowItWorks;