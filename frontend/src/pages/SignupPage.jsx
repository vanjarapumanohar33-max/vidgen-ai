import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";

function SignupPage() {
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [college, setCollege] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [goal, setGoal] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function validateForm() {
    if (!fullName.trim()) {
      return "Please enter your full name.";
    }

    if (!email.trim()) {
      return "Please enter your email address.";
    }

    if (!email.includes("@")) {
      return "Please enter a valid email address.";
    }

    if (accountType === "student" && !college.trim()) {
      return "Please enter your college name.";
    }

    if (accountType === "student" && !branch.trim()) {
      return "Please select or enter your branch.";
    }

    if (accountType === "student" && !semester.trim()) {
      return "Please select your semester.";
    }

    if (password.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    if (!acceptTerms) {
      return "Please accept the Terms and Privacy Policy.";
    }

    return "";
  }

  function getFriendlyAuthError(message) {
    const cleanMessage = String(message || "").toLowerCase();

    if (cleanMessage.includes("already registered")) {
      return "An account already exists with this email. Please log in.";
    }

    if (cleanMessage.includes("invalid email")) {
      return "Please enter a valid email address.";
    }

    if (
      cleanMessage.includes("password") &&
      cleanMessage.includes("characters")
    ) {
      return "Please use a stronger password with at least 8 characters.";
    }

    if (cleanMessage.includes("rate limit")) {
      return "Too many signup attempts. Please wait for a few minutes and try again.";
    }

    return message || "Signup failed. Please try again.";
  }

  async function handleSignup(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccessMessage("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const cleanEmail = email.trim().toLowerCase();

      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?confirmed=true`,
          data: {
            full_name: fullName.trim(),
            account_type: accountType,
            college:
              accountType === "student" ? college.trim() : "",
            branch:
              accountType === "student" ? branch.trim() : "",
            semester:
              accountType === "student" ? semester.trim() : "",
            goal: goal.trim(),
            plan: "Free",
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      if (!data?.user) {
        throw new Error("Supabase could not create the account.");
      }

      /*
       * We intentionally do not store the password or mark the user as
       * logged in inside localStorage. Supabase manages authentication.
       */

      localStorage.removeItem("vidgen_demo_password");
      localStorage.removeItem("vidgen_is_logged_in");
      localStorage.removeItem("vidgen_logged_in");

      setSuccessMessage(
        "Account created successfully. Open your email and click the confirmation link, then log in to VidGen AI."
      );

      setPassword("");
      setConfirmPassword("");
    } catch (signupError) {
      setError(getFriendlyAuthError(signupError?.message));
    } finally {
      setLoading(false);
    }
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
          <span style={styles.brandBadge}>VIDGEN AI</span>

          <h1 style={styles.heroTitle}>
            Convert lectures into
            <span style={styles.highlightText}> exam-ready knowledge.</span>
          </h1>

          <p style={styles.heroDescription}>
            Create your account and generate lecture notes, exam questions,
            MCQs, flashcards, AI Tutor answers and revision PDFs.
          </p>

          <div style={styles.benefitList}>
            <div style={styles.benefitItem}>
              <CheckCircle2 size={18} />
              <span>Multimodal lecture analysis</span>
            </div>

            <div style={styles.benefitItem}>
              <CheckCircle2 size={18} />
              <span>Exact video-duration usage limits</span>
            </div>

            <div style={styles.benefitItem}>
              <CheckCircle2 size={18} />
              <span>Secure Supabase authentication</span>
            </div>
          </div>
        </div>

        <section style={styles.formCard}>
          <div style={styles.formHeader}>
            <div style={styles.formIcon}>
              <GraduationCap size={25} />
            </div>

            <div>
              <h2 style={styles.formTitle}>Create your account</h2>
              <p style={styles.formSubtitle}>
                Start with the Free plan and upgrade later.
              </p>
            </div>
          </div>

          {successMessage && (
            <div style={styles.successBox}>
              <CheckCircle2 size={20} />
              <div>
                <strong>Email confirmation required</strong>
                <p>{successMessage}</p>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  style={styles.loginAfterSignupButton}
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}

          {error && <div style={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSignup} style={styles.form}>
            <div style={styles.accountSelector}>
              <button
                type="button"
                onClick={() => {
                  setAccountType("student");
                  setError("");
                }}
                style={{
                  ...styles.accountButton,
                  ...(accountType === "student"
                    ? styles.activeAccountButton
                    : {}),
                }}
              >
                Student
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountType("learner");
                  setError("");
                }}
                style={{
                  ...styles.accountButton,
                  ...(accountType === "learner"
                    ? styles.activeAccountButton
                    : {}),
                }}
              >
                Learner
              </button>
            </div>

            <label style={styles.label}>
              Full name
              <div style={styles.inputWrapper}>
                <User size={18} style={styles.inputIcon} />

                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  style={styles.input}
                />
              </div>
            </label>

            <label style={styles.label}>
              Email address
              <div style={styles.inputWrapper}>
                <Mail size={18} style={styles.inputIcon} />

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

            {accountType === "student" && (
              <>
                <label style={styles.label}>
                  College
                  <input
                    type="text"
                    value={college}
                    onChange={(event) => {
                      setCollege(event.target.value);
                      setError("");
                    }}
                    placeholder="Example: RCEE, Eluru"
                    style={styles.standardInput}
                  />
                </label>

                <div style={styles.twoColumnGrid}>
                  <label style={styles.label}>
                    Branch
                    <input
                      type="text"
                      value={branch}
                      onChange={(event) => {
                        setBranch(event.target.value);
                        setError("");
                      }}
                      placeholder="Example: ECE"
                      style={styles.standardInput}
                    />
                  </label>

                  <label style={styles.label}>
                    Semester
                    <select
                      value={semester}
                      onChange={(event) => {
                        setSemester(event.target.value);
                        setError("");
                      }}
                      style={styles.standardInput}
                    >
                      <option value="">Select semester</option>
                      <option value="1-1">1-1 Semester</option>
                      <option value="1-2">1-2 Semester</option>
                      <option value="2-1">2-1 Semester</option>
                      <option value="2-2">2-2 Semester</option>
                      <option value="3-1">3-1 Semester</option>
                      <option value="3-2">3-2 Semester</option>
                      <option value="4-1">4-1 Semester</option>
                      <option value="4-2">4-2 Semester</option>
                    </select>
                  </label>
                </div>
              </>
            )}

            <label style={styles.label}>
              Main learning goal
              <input
                type="text"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder={
                  accountType === "student"
                    ? "Example: Semester exams, GATE, VLSI"
                    : "What would you like to learn?"
                }
                style={styles.standardInput}
              />
            </label>

            <label style={styles.label}>
              Password
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  style={styles.passwordInput}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  style={styles.eyeButton}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label style={styles.label}>
              Confirm password
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter password again"
                  autoComplete="new-password"
                  style={styles.passwordInput}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <label style={styles.termsRow}>
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => {
                  setAcceptTerms(event.target.checked);
                  setError("");
                }}
              />

              <span>
                I agree to the Terms of Service and Privacy Policy.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitButton,
                ...(loading ? styles.disabledButton : {}),
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} style={styles.loaderIcon} />
                  Creating account...
                </>
              ) : (
                "Create Free Account"
              )}
            </button>

            <p style={styles.loginText}>
              Already have an account?{" "}
              <Link to="/login" style={styles.loginLink}>
                Log in
              </Link>
            </p>
          </form>
        </section>
      </section>
    </main>
  );
}

const styles = {
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
    width: "min(1180px, 100%)",
    margin: "38px auto",
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(360px, 1fr)",
    gap: "56px",
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
    fontSize: "clamp(40px, 6vw, 72px)",
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
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "30px",
    background: "rgba(15,15,18,0.88)",
    boxShadow: "0 30px 100px rgba(0,0,0,0.46)",
    backdropFilter: "blur(20px)",
    padding: "30px",
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
    gap: "12px",
    marginBottom: "18px",
    borderRadius: "17px",
    border: "1px solid rgba(38,166,91,0.32)",
    background: "rgba(38,166,91,0.1)",
    color: "#d7ffe4",
    padding: "14px",
  },

  loginAfterSignupButton: {
    marginTop: "10px",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    padding: "8px 13px",
    cursor: "pointer",
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
    gap: "17px",
  },

  accountSelector: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "9px",
    padding: "5px",
    borderRadius: "17px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  accountButton: {
    minHeight: "43px",
    border: "none",
    borderRadius: "13px",
    background: "transparent",
    color: "rgba(255,255,255,0.62)",
    fontWeight: 700,
    cursor: "pointer",
  },

  activeAccountButton: {
    background: "linear-gradient(135deg, #e50914, #930009)",
    color: "#ffffff",
    boxShadow: "0 10px 30px rgba(229,9,20,0.2)",
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
    minHeight: "49px",
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
    minHeight: "49px",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "15px",
    outline: "none",
    background: "rgba(255,255,255,0.055)",
    color: "#ffffff",
    padding: "0 48px 0 44px",
  },

  standardInput: {
    width: "100%",
    minHeight: "49px",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "15px",
    outline: "none",
    background: "#17171b",
    color: "#ffffff",
    padding: "0 14px",
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

  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "13px",
  },

  termsRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    color: "rgba(255,255,255,0.62)",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  submitButton: {
    minHeight: "51px",
    border: "none",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #e50914, #a30009)",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    cursor: "pointer",
    boxShadow: "0 16px 36px rgba(229,9,20,0.24)",
  },

  disabledButton: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  loaderIcon: {
    animation: "spin 1s linear infinite",
  },

  loginText: {
    margin: "2px 0 0",
    textAlign: "center",
    color: "rgba(255,255,255,0.58)",
    fontSize: "14px",
  },

  loginLink: {
    color: "#ff4d55",
    fontWeight: 800,
    textDecoration: "none",
  },
};

export default SignupPage;