"use client";

import { useEffect, useState, type ReactNode } from "react";

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [maxHeight, setMaxHeight] = useState("92dvh");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function update() {
      const height = window.visualViewport?.height ?? window.innerHeight;
      setMaxHeight(`${Math.round(height * 0.92)}px`);
    }
    update();

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel"
        style={{ maxHeight }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" className="sheet-close" onClick={onClose}>
              Закрыть
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
