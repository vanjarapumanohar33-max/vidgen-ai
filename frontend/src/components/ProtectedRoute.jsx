import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { supabase } from "../lib/supabaseClient";

function ProtectedRoute({ children }) {
  const location = useLocation();

  const [authStatus, setAuthStatus] = useState("checking");

  useEffect(() => {
    let componentActive = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!componentActive) {
          return;
        }

        if (session?.user) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      }
    );

    return () => {
      componentActive = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authStatus === "checking") {
    return (
      <main style={styles.loadingPage}>
        <Loader2
          size={32}
          style={styles.loadingIcon}
        />

        <p style={styles.loadingText}>
          Verifying secure session...
        </p>
      </main>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return children;
}

const styles = {
  loadingPage: {
    position: "relative",
    zIndex: 20,
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: "12px",
    background:
      "linear-gradient(145deg, #050506, #0c0c0f 52%, #020203)",
    color: "#ffffff",
  },

  loadingIcon: {
    animation: "spin 1s linear infinite",
    color: "#e50914",
  },

  loadingText: {
    margin: 0,
    color: "rgba(255,255,255,0.65)",
    fontSize: "14px",
  },
};

export default ProtectedRoute;