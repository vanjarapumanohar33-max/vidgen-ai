import { motion } from "framer-motion";

function FeatureCard({ emoji, title, description }) {
  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    card.style.setProperty("--x", `${x}px`);
    card.style.setProperty("--y", `${y}px`);
  };

  return (
    <motion.div
      className="feature-card glass-card"
      onMouseMove={handleMouseMove}
      whileHover={{
        y: -12,
        scale: 1.04,
      }}
      transition={{
        duration: 0.3,
      }}
    >
      <div className="feature-icon">
        {emoji}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>
    </motion.div>
  );
}

export default FeatureCard;