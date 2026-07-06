import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <h3>VIDGEN AI</h3>

        <p>
          AI-powered study material generation for students and safe learners.
        </p>
      </div>

      <div className="footer-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#preview">Preview</a>
        <Link to="/signup">Start Free</Link>
      </div>
    </footer>
  );
}

export default Footer;