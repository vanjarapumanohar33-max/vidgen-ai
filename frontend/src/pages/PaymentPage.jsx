import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  GraduationCap,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";

import "./PaymentPage.css";

function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const incomingPlan = location.state?.selectedPlan;
  const incomingAccountType =
    location.state?.accountType ||
    localStorage.getItem("vidgen_account_type") ||
    "student";

  const fallbackPlan =
    incomingAccountType === "student"
      ? {
          name: "Go",
          price: "₹99",
          label: "Serious Daily Study",
          dailyHours: 10,
          description:
            "Best for students who use YouTube lectures regularly for revision.",
          features: [
            "10 hours daily video limit",
            "Exam focus section",
            "10 MCQs with answer key",
            "Notes PDF export",
          ],
        }
      : {
          name: "Go",
          price: "₹169",
          label: "Focused Learning",
          dailyHours: 10,
          description:
            "Best for regular learners who watch educational videos and tutorials.",
          features: [
            "10 hours daily video limit",
            "Key insights",
            "10 MCQs with answer key",
            "Notes PDF export",
          ],
        };

  const selectedPlan = incomingPlan || fallbackPlan;
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [processing, setProcessing] = useState(false);

  const isStudent = incomingAccountType === "student";

  function completePayment() {
    setProcessing(true);

    setTimeout(() => {
      localStorage.setItem("vidgen_account_type", incomingAccountType);
      localStorage.setItem("vidgen_plan", selectedPlan.name);
      localStorage.setItem(
        "vidgen_daily_hours",
        String(selectedPlan.dailyHours)
      );
      localStorage.setItem("vidgen_payment_preview", "completed");

      setProcessing(false);
      navigate("/dashboard");
    }, 1400);
  }

  return (
    <main className="payment-page">
      <section className="payment-shell">
        <button className="payment-back" onClick={() => navigate("/plans")}>
          <ArrowLeft size={17} />
          Back to plans
        </button>

        <div className="payment-left">
          <div className="payment-kicker">
            <ShieldCheck size={16} />
            Secure payment preview
          </div>

          <h1>Complete your VidGen AI upgrade</h1>

          <p>
            This upgrade unlocks a clearer study workflow with verified study
            packs, better practice tools, exports, and higher daily usage.
          </p>

          <div className="payment-trust-grid">
            <div>
              <ShieldCheck size={20} />
              <h3>Trust-first output</h3>
              <p>Study material is designed around lecture-source grounding.</p>
            </div>

            <div>
              {isStudent ? (
                <GraduationCap size={20} />
              ) : (
                <Sparkles size={20} />
              )}
              <h3>{isStudent ? "Exam-ready" : "Learning-ready"}</h3>
              <p>
                Unlock outputs that are useful for revision, practice, and
                structured learning.
              </p>
            </div>

            <div>
              <Lock size={20} />
              <h3>No hidden confusion</h3>
              <p>
                Your selected plan, price, and benefits are clearly shown before
                activation.
              </p>
            </div>
          </div>
        </div>

        <aside className="payment-card">
          <div className="selected-plan-top">
            <div>
              <span>{selectedPlan.label}</span>
              <h2>{selectedPlan.name} Plan</h2>
            </div>

            <div className="selected-plan-icon">
              {selectedPlan.name === "Pro" ? (
                <Crown size={24} />
              ) : (
                <BadgeCheck size={24} />
              )}
            </div>
          </div>

          <p className="selected-plan-desc">{selectedPlan.description}</p>

          <div className="payment-price-row">
            <strong>{selectedPlan.price}</strong>
            <span>/ month</span>
          </div>

          <div className="payment-limit">
            <Clock size={15} />
            <span>{selectedPlan.dailyHours} hours daily video limit</span>
          </div>

          <div className="payment-benefits">
            {(selectedPlan.features || []).map((feature) => (
              <div key={feature}>
                <CheckCircle2 size={16} />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="method-title">Choose payment method</div>

          <div className="payment-methods">
            <button
              className={paymentMethod === "upi" ? "active-method" : ""}
              onClick={() => setPaymentMethod("upi")}
            >
              <Smartphone size={18} />
              UPI
            </button>

            <button
              className={paymentMethod === "card" ? "active-method" : ""}
              onClick={() => setPaymentMethod("card")}
            >
              <CreditCard size={18} />
              Card
            </button>

            <button
              className={paymentMethod === "wallet" ? "active-method" : ""}
              onClick={() => setPaymentMethod("wallet")}
            >
              <Wallet size={18} />
              Wallet
            </button>
          </div>

          <div className="payment-preview-box">
            {paymentMethod === "upi" && (
              <>
                <label>UPI ID</label>
                <input type="text" placeholder="yourname@upi" />
              </>
            )}

            {paymentMethod === "card" && (
              <>
                <label>Card details</label>
                <input type="text" placeholder="Card number" />
                <div className="card-mini-row">
                  <input type="text" placeholder="MM/YY" />
                  <input type="text" placeholder="CVV" />
                </div>
              </>
            )}

            {paymentMethod === "wallet" && (
              <>
                <label>Wallet number</label>
                <input type="text" placeholder="Mobile number" />
              </>
            )}
          </div>

          <button className="pay-btn" onClick={completePayment}>
            {processing ? "Activating plan..." : `Pay ${selectedPlan.price}`}
          </button>

          <p className="payment-note">
            Payment integration is in preview mode. Real Razorpay/Stripe
            integration can be added after the full UI is approved.
          </p>
        </aside>
      </section>
    </main>
  );
}

export default PaymentPage;