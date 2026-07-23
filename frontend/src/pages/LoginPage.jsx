import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";

function saveUserDetails(user) {
  const metadata = user?.user_metadata || {};

  localStorage.setItem("vidgen_auth_user_id", user.id);
  localStorage.setItem("vidgen_email", user.email || "");

  localStorage.setItem(
    "vidgen_full_name",
    metadata.full_name ||
      user.email?.split("@")[0] ||
      "VidGen User"
  );

  localStorage.setItem(
    "vidgen_account_type",
    metadata.account_type || "student"
  );

  localStorage.setItem(
    "vidgen_college",
    metadata.college || ""
  );

  localStorage.setItem(
    "vidgen_branch",
    metadata.branch || ""
  );

  localStorage.setItem(
    "vidgen_semester",
    metadata.semester || ""
  );

  localStorage.setItem(
    "vidgen_goal",
    metadata.goal || ""
  );

  /*
   * Temporary compatibility values for the existing dashboard.
   * Supabase session is the real authentication source.
   */
  localStorage.setItem("vidgen_is_logged_in", "true");
  localStorage.setItem("vidgen_logged_in", "true");

  if (!localStorage.getItem("vidgen_plan")) {
    localStorage.setItem("vidgen_plan", "Free");
  }
}

function clearOldFakeAuthData() {
  localStorage.removeItem("vidgen_demo_password");
  localStorage.removeItem("vidgen_password");
}

function getFriendlyLoginError(message) {
  const cleanMessage = String(message || "").toLowerCase();

  if (cleanMessage.includes("invalid login credentials")) {
    return "Incorrect email or password. Please check and try again.";
  }

  if (cleanMessage.includes("email not confirmed")) {
    return "Your email is not confirmed yet. Open the confirmation email sent by VidGen AI.";
  }

  if (cleanMessage.includes("rate limit")) {
    return "Too many login attempts. Please wait for a few minutes and try again.";
  }

  if (
    cleanMessage.includes("network") ||
    cleanMessage.includes("failed to fetch")
  ) {
    return "Unable to connect to the authentication server. Check your internet connection.";
  }

  return message || "Login failed. Please try again.";
}

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /*
   * Initialize directly instead of calling setState inside useEffect.
   */
  const [email, setEmail] = useState(
    () => localStorage.getItem("vidgen_remember_email") || ""
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => Boolean(localStorage.getItem("vidgen_remember_email"))
  );

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] = useState(() => {
    const confirmed = searchParams.get("confirmed");

    if (confirmed === "true") {
      return "Email confirmed successfully. You can now log in to VidGen AI.";
    }

    return "";
  });

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!active) {
          return;
        }

        if (session?.user) {
          saveUserDetails(session.user);
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (sessionError) {
        console.error("Session check failed:", sessionError);
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleLogin(event) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      setSuccessMessage("");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      setSuccessMessage("");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      setSuccessMessage("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data?.session || !data?.user) {
        throw new Error(
          "Supabase did not create a login session."
        );
      }

      clearOldFakeAuthData();
      saveUserDetails(data.user);

      if (rememberMe) {
        localStorage.setItem(
          "vidgen_remember_email",
          cleanEmail
        );
      } else {
        localStorage.removeItem("vidgen_remember_email");
      }

      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      setError(
        getFriendlyLoginError(loginError?.message)
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main style={styles.loadingPage}>
        <Loader2 size={30} style={styles.loaderIcon} />

        <p style={styles.loadingText}>
          Checking secure session...
        </p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.backgroundGlowOne}></div>
      <div style={styles.backgroundGlowTwo}></div>

      <button
        type="button"
        onClick={() => navigate("/")}
        style={styles.backButton}
      >
        <ArrowLeft size={18} />
        Home
      </button>

      <section style={styles.wrapper}>
        <div style={styles.brandSection}>
          <span style={styles.brandBadge}>
            VIDGEN AI
          </span>

          <h1 style={styles.heroTitle}>
            Continue your
            <span style={styles.highlightText}>
              {" "}
              learning journey.
            </span>
          </h1>

          <p style={styles.heroDescription}>
            Log in securely to generate notes, exam
            questions, MCQs, flashcards, revision PDFs and
            AI Tutor answers from your lectures.
          </p>

          <div style={styles.benefitList}>
            <div style={styles.benefitItem}>
              <CheckCircle2 size={18} />
              <span>Secure Supabase authentication</span>
            </div>

            <div style={styles.benefitItem}>
              <CheckCircle2 size={18} />
              <span>
                Your profile and learning details
              </span>
            </div>

            <div style={styles.benefitItem}>
              <CheckCircle2 size={18} />
              <span>
                Protected access to VidGen Dashboard
              </span>
            </div>
          </div>
        </div>

        <section style={styles.formCard}>
          <div style={styles.formHeader}>
            <div style={styles.formIcon}>
              <LogIn size={24} />
            </div>

            <div>
              <h2 style={styles.formTitle}>
                Welcome back
              </h2>

              <p style={styles.formSubtitle}>
                Log in using your confirmed email account.
              </p>
            </div>
          </div>

          {successMessage && (
            <div style={styles.successBox}>
              <CheckCircle2 size={20} />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            style={styles.form}
          >
            <label style={styles.label}>
              Email address

              <div style={styles.inputWrapper}>
                <Mail
                  size={18}
                  style={styles.inputIcon}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  style={styles.input}
                />
              </div>
            </label>

            <label style={styles.label}>
              Password

              <div style={styles.inputWrapper}>
                <Lock
                  size={18}
                  style={styles.inputIcon}
                />

                <input
                  type={
                    showPassword ? "text" : "password"
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={styles.passwordInput}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (currentValue) => !currentValue
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <div style={styles.optionsRow}>
              <label style={styles.rememberRow}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />

                <span>Remember my email</span>
              </label>

              <button
                type="button"
                style={styles.forgotButton}
                onClick={() => {
                  setError("");
                  setSuccessMessage(
                    "Password reset will be connected in the next authentication step."
                  );
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitButton,
                ...(loading
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {loading ? (
                <>
                  <Loader2
                    size={18}
                    style={styles.loaderIcon}
                  />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Log In Securely
                </>
              )}
            </button>

            <p style={styles.signupText}>
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                style={styles.signupLink}
              >
                Create account
              </Link>
            </p>
          </form>
        </section>
      </section>
    </main>
  );
}

const styles = {
  loadingPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: "12px",
    background: "#050506",
    color: "#ffffff",
  },

  loadingText: {
    color: "rgba(255,255,255,0.65)",
  },

  page: {
    position: "relative",
    minHeight: "100vh",
    overflow: "hidden",
    background:
      "radial-gradient(circle at top left, rgba(229,9,20,0.22), transparent 34%), linear-gradient(145deg, #050506, #0c0c0f 52%, #020203)",
    color: "#ffffff",
    padding: "32px",
  },

  backgroundGlowOne: {
    position: "fixed",
    width: "420px",
    height: "420px",
    top: "-180px",
    right: "-130px",
    borderRadius: "50%",
    background: "rgba(229,9,20,0.17)",
    filter: "blur(90px)",
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "fixed",
    width: "380px",
    height: "380px",
    bottom: "-190px",
    left: "-130px",
    borderRadius: "50%",
    background: "rgba(140,0,9,0.14)",
    filter: "blur(90px)",
    pointerEvents: "none",
  },

  backButton: {
    position: "relative",
    zIndex: 2,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    padding: "10px 15px",
    cursor: "pointer",
  },

  wrapper: {
    position: "relative",
    zIndex: 1,
    width: "min(1120px, 100%)",
    margin: "70px auto",
    display: "grid",
    gridTemplateColumns:
      "minmax(280px, 1fr) minmax(350px, 480px)",
    gap: "70px",
    alignItems: "center",
  },

  brandSection: {
    padding: "28px 8px",
  },

  brandBadge: {
    display: "inline-flex",
    borderRadius: "999px",
    border: "1px solid rgba(229,9,20,0.4)",
    background: "rgba(229,9,20,0.14)",
    color: "#ff5058",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.09em",
  },

  heroTitle: {
    margin: "24px 0 18px",
    maxWidth: "650px",
    fontSize: "clamp(42px, 6vw, 74px)",
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
  },

  highlightText: {
    color: "#e50914",
  },

  heroDescription: {
    maxWidth: "570px",
    color: "rgba(255,255,255,0.68)",
    fontSize: "17px",
    lineHeight: 1.7,
  },

  benefitList: {
    marginTop: "28px",
    display: "grid",
    gap: "13px",
  },

  benefitItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "rgba(255,255,255,0.82)",
  },

  formCard: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "30px",
    background: "rgba(15,15,18,0.88)",
    boxShadow: "0 30px 100px rgba(0,0,0,0.46)",
    backdropFilter: "blur(20px)",
    padding: "32px",
  },

  formHeader: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "24px",
  },

  formIcon: {
    width: "50px",
    height: "50px",
    borderRadius: "17px",
    display: "grid",
    placeItems: "center",
    background: "rgba(229,9,20,0.15)",
    color: "#ff434d",
    border: "1px solid rgba(229,9,20,0.3)",
  },

  formTitle: {
    margin: 0,
    fontSize: "27px",
  },

  formSubtitle: {
    margin: "5px 0 0",
    color: "rgba(255,255,255,0.56)",
  },

  successBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "18px",
    borderRadius: "15px",
    border: "1px solid rgba(38,166,91,0.32)",
    background: "rgba(38,166,91,0.1)",
    color: "#d7ffe4",
    padding: "13px 14px",
    lineHeight: 1.5,
  },

  errorBox: {
    marginBottom: "18px",
    borderRadius: "15px",
    border: "1px solid rgba(229,9,20,0.35)",
    background: "rgba(229,9,20,0.11)",
    color: "#ffc5c8",
    padding: "13px 14px",
  },

  form: {
    display: "grid",
    gap: "18px",
  },

  label: {
    display: "grid",
    gap: "8px",
    color: "rgba(255,255,255,0.78)",
    fontSize: "14px",
    fontWeight: 600,
  },

  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  inputIcon: {
    position: "absolute",
    left: "14px",
    color: "rgba(255,255,255,0.42)",
    pointerEvents: "none",
  },

  input: {
    width: "100%",
    minHeight: "50px",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "15px",
    outline: "none",
    background: "rgba(255,255,255,0.055)",
    color: "#ffffff",
    padding: "0 14px 0 44px",
  },

  passwordInput: {
    width: "100%",
    minHeight: "50px",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "15px",
    outline: "none",
    background: "rgba(255,255,255,0.055)",
    color: "#ffffff",
    padding: "0 48px 0 44px",
  },

  eyeButton: {
    position: "absolute",
    right: "12px",
    width: "34px",
    height: "34px",
    border: "none",
    borderRadius: "10px",
    background: "transparent",
    color: "rgba(255,255,255,0.55)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },

  optionsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
  },

  rememberRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "rgba(255,255,255,0.6)",
    fontSize: "13px",
  },

  forgotButton: {
    border: "none",
    background: "transparent",
    color: "#ff4d55",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },

  submitButton: {
    minHeight: "52px",
    border: "none",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, #e50914, #a30009)",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    cursor: "pointer",
    boxShadow:
      "0 16px 36px rgba(229,9,20,0.24)",
  },

  disabledButton: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  loaderIcon: {
    animation: "spin 1s linear infinite",
  },

  signupText: {
    margin: "2px 0 0",
    textAlign: "center",
    color: "rgba(255,255,255,0.58)",
    fontSize: "14px",
  },

  signupLink: {
    color: "#ff4d55",
    fontWeight: 800,
    textDecoration: "none",
  },
};

export default LoginPage;