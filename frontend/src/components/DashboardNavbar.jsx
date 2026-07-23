import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Settings,
  Crown,
  User,
  CreditCard,
  LogOut,
  ChevronDown,
  Loader2,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./DashboardNavbar.css";

function clearLocalAuthData() {
  const authKeys = [
    "vidgen_is_logged_in",
    "vidgen_logged_in",
    "vidgen_auth_user_id",
    "vidgen_email",
    "vidgen_full_name",
    "vidgen_account_type",
    "vidgen_college",
    "vidgen_branch",
    "vidgen_semester",
    "vidgen_goal",
    "vidgen_demo_password",
    "vidgen_password",
    "vidgen_user_name",
    "vidgen_user_email",
  ];

  authKeys.forEach((key) => {
    localStorage.removeItem(key);
  });
}

function DashboardNavbar() {
  const navigate = useNavigate();

  const [openSettings, setOpenSettings] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [logoutError, setLogoutError] =
    useState("");

  const userName =
    localStorage.getItem("vidgen_full_name") ||
    localStorage.getItem("vidgen_user_name") ||
    "VidGen User";

  const email =
    localStorage.getItem("vidgen_email") ||
    localStorage.getItem("vidgen_user_email") ||
    "user@vidgen.ai";

  const accountType =
    localStorage.getItem("vidgen_account_type") ||
    "student";

  const plan =
    localStorage.getItem("vidgen_plan") ||
    "Free";

  const firstName =
    userName.trim().split(/\s+/)[0] ||
    "User";

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);
      setLogoutError("");

      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        throw error;
      }

      clearLocalAuthData();

      setOpenSettings(false);

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error("Logout failed:", error);

      setLogoutError(
        error?.message ||
          "Unable to log out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="dashboard-navbar">
      <div className="dashboard-user">
        <div>
          Hi, {firstName} 👋
        </div>

        <span className="current-plan">
          {plan}
        </span>
      </div>

      <div className="dashboard-nav-actions">
        <Link
          to="/plans"
          className="dashboard-upgrade"
        >
          <Crown size={15} />
          <span>Upgrade</span>
        </Link>

        <div className="settings-wrapper">
          <button
            type="button"
            className="dashboard-settings"
            onClick={() => {
              setOpenSettings(
                (currentValue) => !currentValue
              );

              setLogoutError("");
            }}
            aria-expanded={openSettings}
            aria-label="Open account settings"
          >
            <Settings size={16} />
            <span>Settings</span>
            <ChevronDown size={14} />
          </button>

          {openSettings && (
            <div className="settings-dropdown">
              <div className="settings-profile">
                <div className="settings-avatar">
                  {userName
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <h4>{userName}</h4>
                  <p>{email}</p>
                </div>
              </div>

              <div className="settings-divider" />

              <button
                type="button"
                className="settings-item"
                onClick={() => {
                  setOpenSettings(false);
                  navigate("/profile");
                }}
              >
                <User size={16} />

                <div>
                  <span>Profile</span>

                  <small>
                    {accountType === "learner"
                      ? "Learner account"
                      : "Student account"}
                  </small>
                </div>
              </button>

              <button
                type="button"
                className="settings-item"
                onClick={() => {
                  setOpenSettings(false);
                  navigate("/plans");
                }}
              >
                <CreditCard size={16} />

                <div>
                  <span>Plan & Billing</span>
                  <small>{plan} plan active</small>
                </div>
              </button>

              <div className="settings-divider" />

              <button
                type="button"
                className="settings-item logout-item"
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  opacity: loggingOut ? 0.65 : 1,
                  cursor: loggingOut
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {loggingOut ? (
                  <Loader2
                    size={16}
                    style={{
                      animation:
                        "spin 1s linear infinite",
                    }}
                  />
                ) : (
                  <LogOut size={16} />
                )}

                <div>
                  <span>
                    {loggingOut
                      ? "Logging out..."
                      : "Logout"}
                  </span>

                  <small>
                    End this secure session
                  </small>
                </div>
              </button>

              {logoutError && (
                <p
                  style={{
                    margin: "8px 12px 4px",
                    color: "#ff858b",
                    fontSize: "12px",
                    lineHeight: 1.4,
                  }}
                >
                  {logoutError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default DashboardNavbar;