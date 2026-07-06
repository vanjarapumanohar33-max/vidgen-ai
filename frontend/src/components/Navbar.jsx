import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <span>VIDGEN</span>
        <strong>AI</strong>
      </Link>

      <div className="nav-buttons">
        <Link to="/login" className="login-btn">
          Login
        </Link>

        <Link to="/signup" className="signup-btn">
          Start Free
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;