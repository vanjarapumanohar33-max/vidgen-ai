import { useEffect, useRef, useState } from "react";
import { Brain, Loader2, MessageCircle, Send, X } from "lucide-react";

import { askTutor } from "../api/vidgenApi";
import "./AITutorPanel.css";

function AITutorPanel({ open, onClose, topic = "Uploaded Lecture", notes = [] }) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Hi, I’m your VidGen AI Tutor. Ask any doubt from this lecture and I’ll explain it in simple, exam-ready words.",
    },
  ]);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  }, [open, messages, thinking]);

  async function handleSend(event) {
    event?.preventDefault();

    const finalText = input.trim();

    if (!finalText) return;

    setMessages((previousMessages) => [
      ...previousMessages,
      {
        role: "user",
        text: finalText,
      },
    ]);

    setInput("");

    try {
      setThinking(true);

      const result = await askTutor({
        question: finalText,
        topic,
        notes,
      });

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          text: result.answer,
        },
      ]);
    } catch (error) {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          text:
            error.message ||
            "I couldn’t answer right now. Please try again in a few seconds.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      <div
        className={open ? "ai-tutor-backdrop open" : "ai-tutor-backdrop"}
        onClick={onClose}
      ></div>

      <aside className={open ? "ai-tutor-panel open" : "ai-tutor-panel"}>
        <header className="tutor-header">
          <div className="tutor-title-block">
            <div className="tutor-icon">
              <MessageCircle size={20} />
            </div>

            <div>
              <h2>Lecture AI Tutor</h2>
              <p>Clear answers from your generated study pack</p>
            </div>
          </div>

          <button className="tutor-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </header>

        <section className="tutor-chat-area">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "chat-message user-message"
                  : "chat-message assistant-message"
              }
            >
              {message.role === "assistant" && (
                <div className="message-avatar">
                  <Brain size={15} />
                </div>
              )}

              <p>{message.text}</p>
            </div>
          ))}

          {thinking && (
            <div className="chat-message assistant-message">
              <div className="message-avatar">
                <Loader2 size={15} className="thinking-icon" />
              </div>

              <p>Preparing a clear answer...</p>
            </div>
          )}

          <div ref={chatEndRef}></div>
        </section>

        <form className="tutor-input-row" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Ask a doubt from this lecture..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />

          <button type="submit" aria-label="Send message">
            <Send size={18} />
          </button>
        </form>
      </aside>
    </>
  );
}

export default AITutorPanel;