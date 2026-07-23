import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

import { upgradePlanWithRazorpay } from "../api/vidgenApi";

function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedPlan = searchParams.get("plan") || "Go";

  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(
    "Payment is required to activate Go or Pro plan."
  );

  useEffect(() => {
    async function startPayment() {
      const cleanPlan =
        requestedPlan.toLowerCase() === "pro" ? "Pro" : "Go";

      try {
        setStatus("loading");
        setMessage(`Opening Razorpay checkout for ${cleanPlan} plan...`);

        const result = await upgradePlanWithRazorpay(cleanPlan);

        if (!result?.success) {
          throw new Error("Payment verification failed.");
        }

        setStatus("success");
        setMessage(`${result.plan || cleanPlan} plan activated successfully.`);

        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "Payment failed or cancelled.");
      }
    }

    startPayment();
  }, [navigate, requestedPlan]);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.iconBox}>
          {status === "loading" && <Loader2 size={34} style={styles.loader} />}
          {status === "success" && <CheckCircle2 size={34} />}
          {status === "error" && <XCircle size={34} />}
          {status === "idle" && <ShieldCheck size={34} />}
        </div>

        <h1 style={styles.title}>
          {status === "success"
            ? "Payment Verified"
            : status === "error"
            ? "Payment Not Completed"
            : "Secure Payment"}
        </h1>

        <p style={styles.message}>{message}</p>

        {status === "error" && (
          <div style={styles.actions}>
            <button
              style={styles.primaryButton}
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>

            <button
              style={styles.secondaryButton}
              onClick={() => navigate("/plans")}
            >
              Back to Plans
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at top, rgba(229,9,20,0.24), transparent 34%), linear-gradient(180deg, #09090b, #000)",
    color: "#fff",
    padding: "24px",
  },
  card: {
    width: "min(520px, 94vw)",
    textAlign: "center",
    padding: "34px",
    borderRadius: "28px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.35)",
  },
  iconBox: {
    width: "76px",
    height: "76px",
    margin: "0 auto 18px",
    borderRadius: "24px",
    display: "grid",
    placeItems: "center",
    background: "rgba(229,9,20,0.16)",
    color: "#ff4d4d",
  },
  loader: {
    animation: "spin 1s linear infinite",
  },
  title: {
    margin: "0 0 10px",
    fontSize: "34px",
  },
  message: {
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.6,
  },
  actions: {
    marginTop: "22px",
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "999px",
    background: "#e50914",
    color: "#fff",
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
};

export default PaymentPage;