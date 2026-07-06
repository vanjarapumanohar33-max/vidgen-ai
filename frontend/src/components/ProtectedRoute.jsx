import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const isLoggedIn =
    localStorage.getItem("vidgen_is_logged_in") === "true";

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;