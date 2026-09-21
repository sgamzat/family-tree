"use client";

import { useEffect, useState, type RefObject } from "react";

export function scrollFieldBelowHeader(field: HTMLElement) {
  const header = document.querySelector(".site-header");
  const offset = (header?.getBoundingClientRect().height ?? 0) + 8;
  const top = window.scrollY + field.getBoundingClientRect().top - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export function useDropdownMax(
  inputRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  layoutKey: string | number = "",
) {
  const [listMax, setListMax] = useState(220);

  useEffect(() => {
    if (!enabled) return;

    function layout() {
      const input = inputRef.current;
      const viewport = window.visualViewport;
      if (!input) return;
      const viewBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;
      const room = viewBottom - input.getBoundingClientRect().bottom - 12;
      setListMax(Math.max(120, Math.floor(room)));
    }

    layout();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", layout);
    viewport?.addEventListener("scroll", layout);
    window.addEventListener("resize", layout);
    return () => {
      viewport?.removeEventListener("resize", layout);
      viewport?.removeEventListener("scroll", layout);
      window.removeEventListener("resize", layout);
    };
  }, [enabled, inputRef, layoutKey]);

  return listMax;
}
