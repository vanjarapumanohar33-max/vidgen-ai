import { useState } from "react";
import {
  PanelLeftClose,
  PanelRightOpen,
  Plus,
  Search,
  Pin,
  Library,
  Clock3,
  MessageSquareText,
} from "lucide-react";

import "./DashboardSidebar.css";

function DashboardSidebar({
  onNewChat = () => {},
  onOpenPanel = () => {},
  onOpenRecent = () => {},
}) {
  const [collapsed, setCollapsed] = useState(false);

  const userName =
    localStorage.getItem("vidgen_user_name") || "Manohar";

  const accountType =
    localStorage.getItem("vidgen_account_type") || "student";

  const recents = JSON.parse(
    localStorage.getItem("vidgen_recents") || "[]"
  );

  const menuItems = [
    {
      icon: <Plus size={18} />,
      label: "New chat",
      action: onNewChat,
    },
    {
      icon: <Search size={18} />,
      label: "Search",
      action: () => onOpenPanel("search"),
    },
    {
      icon: <Pin size={18} />,
      label: "Pinned",
      action: () => onOpenPanel("pinned"),
    },
    {
      icon: <Library size={18} />,
      label: "Library",
      action: () => onOpenPanel("library"),
    },
  ];

  return (
    <aside
      className={`dashboard-sidebar ${
        collapsed ? "collapsed" : ""
      }`}
    >
      <div className="sidebar-header">
        {collapsed ? (
          <button
            className="collapsed-logo-button"
            onClick={() => setCollapsed(false)}
            title="Open sidebar"
          >
            <span className="collapsed-logo-content">
              <span>V</span>
              <i></i>
            </span>

            <span className="collapsed-hover-icon">
              <PanelRightOpen size={20} />
            </span>
          </button>
        ) : (
          <>
            <div className="sidebar-logo" title="VidGen AI">
              <span>V</span>
              <i></i>
            </div>

            <button
              className="sidebar-toggle"
              onClick={() => setCollapsed(true)}
              title="Close sidebar"
            >
              <PanelLeftClose size={20} />
            </button>
          </>
        )}
      </div>

      <div className="sidebar-profile">
        <div className="profile-avatar">
          {userName.charAt(0).toUpperCase()}
        </div>

        {!collapsed && (
          <div className="profile-details">
            <div className="profile-name-row">
              <h3>{userName.split(" ")[0]}</h3>
            </div>

            <p>
              {accountType === "learner"
                ? "Learner"
                : "Student"}
            </p>
          </div>
        )}
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className="sidebar-item"
            title={collapsed ? item.label : ""}
            onClick={item.action}
          >
            <span className="sidebar-icon">
              {item.icon}
            </span>

            {!collapsed && (
              <span className="sidebar-label">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="sidebar-recents">
          <div className="recents-title">
            <Clock3 size={15} />
            <span>Recents</span>
          </div>

          <div className="recents-list">
            {recents.length === 0 ? (
              <div className="empty-recents">
                Your recent study sessions will appear here.
              </div>
            ) : (
              recents.slice(0, 8).map((item, index) => (
                <button
                  key={`${item.videoId}-${index}`}
                  className="recent-chat-item"
                  onClick={() => onOpenRecent(item)}
                  title={item.title || "Generated Study Material"}
                >
                  <MessageSquareText size={15} />

                  <span>
                    {item.title || "Generated Study Material"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

export default DashboardSidebar;