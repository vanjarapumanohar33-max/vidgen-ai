import { useEffect, useRef, useState } from "react";

function Reveal({ children, delay = 0, className = "" }) {
  const elementRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const currentElement = elementRef.current;

    if (!currentElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(currentElement);
        }
      },
      {
        threshold: 0.16,
      }
    );

    observer.observe(currentElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={elementRef}
      className={`reveal-block ${visible ? "revealed" : ""} ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default Reveal;