import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Settings,
  Crown,
  User,
  CreditCard,
  LogOut,
  ChevronDown,
} from "lucide-react";

import "./DashboardNavbar.css";

function DashboardNavbar() {
  const navigate = useNavigate();

  const [openSettings, setOpenSettings] = useState(false);

  const userName =
    localStorage.getItem("vidgen_user_name") || "Manohar";

  const email =
    localStorage.getItem("vidgen_user_email") || "user@vidgen.ai";

  const accountType =
    localStorage.getItem("vidgen_account_type") || "student";

  const plan =
    localStorage.getItem("vidgen_plan") || "Free";

  const handleLogout = () => {
    localStorage.setItem("vidgen_logged_in", "false");
    navigate("/login");
  };

  return (
    <nav className="dashboard-navbar">
      <div className="dashboard-user">
        <div>
          Hi, {userName.split(" ")[0]} 👋
        </div>

        <span className="current-plan">
          {plan}
        </span>
      </div>

      <div className="dashboard-nav-actions">
        <Link to="/plans" className="dashboard-upgrade">
          <Crown size={15} />
          <span>Upgrade</span>
        </Link>

        <div className="settings-wrapper">
          <button
            className="dashboard-settings"
            onClick={() => setOpenSettings(!openSettings)}
          >
            <Settings size={16} />
            <span>Settings</span>
            <ChevronDown size={14} />
          </button>

          {openSettings && (
            <div className="settings-dropdown">
              <div className="settings-profile">
                <div className="settings-avatar">
                  {userName.charAt(0).toUpperCase()}
                </div>

                <div>
                  <h4>{userName}</h4>
                  <p>{email}</p>
                </div>
              </div>

              <div className="settings-divider"></div>

              <button
                className="settings-item"
                onClick={() => navigate("/profile")}
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
                className="settings-item"
                onClick={() => navigate("/plans")}
              >
                <CreditCard size={16} />
                <div>
                  <span>Plan & Billing</span>
                  <small>{plan} plan active</small>
                </div>
              </button>

              <div className="settings-divider"></div>

              <button
                className="settings-item logout-item"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <div>
                  <span>Logout</span>
                  <small>End this session</small>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default DashboardNavbar;