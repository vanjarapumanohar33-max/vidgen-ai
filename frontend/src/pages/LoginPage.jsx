import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Lock,
  Mail,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";

import "./Auth.css";

function LoginPage() {
  const navigate = useNavigate();

  function handleLogin(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim();
    const password = formData.get("password")?.toString();

    const savedEmail = localStorage.getItem("vidgen_user_email");
    const savedPassword = localStorage.getItem("vidgen_demo_password");

    if (savedEmail && savedPassword) {
      if (email !== savedEmail || password !== savedPassword) {
        alert("Invalid email or password for this demo account.");
        return;
      }
    }

    localStorage.setItem("vidgen_is_logged_in", "true");
    localStorage.setItem("vidgen_user_email", email || "student@vidgen.ai");

    navigate("/dashboard");
  }

  function handleDemoLogin() {
    localStorage.setItem("vidgen_is_logged_in", "true");
    localStorage.setItem("vidgen_user_name", "Student");
    localStorage.setItem("vidgen_user_email", "student@vidgen.ai");
    localStorage.setItem("vidgen_account_type", "student");
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

      <section className="auth-card clean-auth-card">
        <div className="auth-header">
          <span>
            <ShieldCheck size={14} />
            Welcome back
          </span>

          <h1>Login to your workspace.</h1>

          <p>
            Continue your lecture notes, exam focus, practice packs, and saved
            study material.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
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
                placeholder="Enter your password"
                required
              />
            </div>
          </label>

          <div className="auth-row">
            <label className="auth-check">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>

            <button type="button" className="auth-text-btn">
              Forgot password?
            </button>
          </div>

          <button type="submit" className="auth-primary-btn">
            <span>Login</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-divider">
          <span></span>
          or
          <span></span>
        </div>

        <button className="auth-demo-btn" type="button" onClick={handleDemoLogin}>
          <PlayCircle size={18} />
          <span>Continue with demo account</span>
        </button>

        <p className="auth-switch">
          New to VidGen AI? <Link to="/signup">Create account</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;