import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

import "./Auth.css";

function SignupPage() {
  const navigate = useNavigate();

  function handleSignup(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const password = formData.get("password")?.toString();
    const accountType = formData.get("accountType")?.toString();

    if (!name || !email || !password) {
      alert("Please fill all details.");
      return;
    }

    if (password.length < 6) {
      alert("Password should be at least 6 characters for demo signup.");
      return;
    }

    localStorage.setItem("vidgen_is_logged_in", "true");
    localStorage.setItem("vidgen_user_name", name);
    localStorage.setItem("vidgen_user_email", email);
    localStorage.setItem("vidgen_demo_password", password);
    localStorage.setItem("vidgen_account_type", accountType || "student");
    localStorage.setItem("vidgen_plan", "free");

    navigate("/dashboard");
  }

  return (
    <main className="auth-page">
      <div className="auth-particles" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index}></span>
        ))}
      </div>

      <Link to="/" className="auth-brand">
        VIDGEN <strong>AI</strong>
      </Link>

      <section className="auth-card clean-auth-card signup-card">
        <div className="auth-header">
          <span>
            <ShieldCheck size={14} />
            Create account
          </span>

          <h1>Start your study workspace.</h1>

          <p>
            Choose your learning mode and turn lectures into clean study packs.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSignup}>
          <div className="auth-mode-block">
            <p>Choose your mode</p>

            <div className="auth-type-grid">
              <label className="auth-type-card">
                <input
                  type="radio"
                  name="accountType"
                  value="student"
                  defaultChecked
                />

                <div className="auth-type-icon">
                  <GraduationCap size={20} />
                </div>

                <span>
                  <strong>Student</strong>
                  <small>Exam-ready notes and revision</small>
                </span>
              </label>

              <label className="auth-type-card">
                <input type="radio" name="accountType" value="learner" />

                <div className="auth-type-icon">
                  <BookOpen size={20} />
                </div>

                <span>
                  <strong>Learner</strong>
                  <small>Understand lectures deeply</small>
                </span>
              </label>
            </div>
          </div>

          <label className="auth-field">
            <span>Full name</span>

            <div className="auth-input-shell">
              <User size={18} />
              <input
                type="text"
                name="name"
                placeholder="Enter your name"
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Email address</span>

            <div className="auth-input-shell">
              <Mail size={18} />
              <input
                type="email"
                name="email"
                placeholder="student@example.com"
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>

            <div className="auth-input-shell">
              <Lock size={18} />
              <input
                type="password"
                name="password"
                placeholder="Create password"
                required
              />
            </div>
          </label>

          <label className="auth-check terms-check">
            <input type="checkbox" required />
            <span>I agree to use this as a demo study workspace.</span>
          </label>

          <button type="submit" className="auth-primary-btn">
            <span>Create account</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

export default SignupPage;