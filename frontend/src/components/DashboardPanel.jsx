import { useMemo, useState } from "react";
import {
  X,
  Search,
  Pin,
  Library,
  Clock3,
  FileText,
  Play,
} from "lucide-react";

import "./DashboardPanel.css";

function DashboardPanel({
  open,
  type,
  onClose,
  onOpenItem = () => {},
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const recents = JSON.parse(
    localStorage.getItem("vidgen_recents") || "[]"
  );

  const pinned = JSON.parse(
    localStorage.getItem("vidgen_pinned") || "[]"
  );

  const getTitle = () => {
    if (type === "search") return "Search";
    if (type === "pinned") return "Pinned";
    if (type === "library") return "Library";
    return "Recents";
  };

  const getIcon = () => {
    if (type === "search") return <Search size={18} />;
    if (type === "pinned") return <Pin size={18} />;
    if (type === "library") return <Library size={18} />;
    return <Clock3 size={18} />;
  };

  const baseList = useMemo(() => {
    if (type === "pinned") return pinned;
    if (type === "library") return recents;
    return recents;
  }, [type, pinned, recents]);

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return baseList;

    return baseList.filter((item) =>
      item.title
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  }, [baseList, searchTerm]);

  const getEmptyText = () => {
    if (type === "search") {
      return "Search results will appear here after you generate study material.";
    }

    if (type === "pinned") {
      return "Pinned lectures will appear here when you save important sessions.";
    }

    if (type === "library") {
      return "Your generated notes, PDFs, and study materials will appear here.";
    }

    return "Your recent generated lectures will appear here.";
  };

  return (
    <aside className={`dashboard-panel ${open ? "open" : ""}`}>
      <div className="panel-header">
        <div>
          {getIcon()}
          <h3>{getTitle()}</h3>
        </div>

        <button onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {(type === "search" || type === "library" || type === "recents") && (
        <div className="panel-search-box">
          <Search size={16} />

          <input
            type="text"
            placeholder="Search generated lectures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      <div className="panel-list">
        {filteredList.length === 0 ? (
          <div className="empty-panel">
            <FileText size={34} />

            <h4>No items yet</h4>

            <p>{getEmptyText()}</p>
          </div>
        ) : (
          filteredList.map((item, index) => (
            <button
              className="panel-item"
              key={`${item.videoId}-${index}`}
              onClick={() => onOpenItem(item)}
            >
              <div className="panel-item-icon">
                <Play size={17} />
              </div>

              <div className="panel-item-content">
                <h4>{item.title || "Generated Study Material"}</h4>

                <p>{item.date || "Recently generated"}</p>

                <span>
                  {item.plan || "Free"} •{" "}
                  {item.accountType === "learner"
                    ? "Learner"
                    : "Student"}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

export default DashboardPanel;