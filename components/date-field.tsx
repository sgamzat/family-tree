"use client";

import { useRef } from "react";
import { tidyDateText, toIsoForPicker } from "@/lib/dates";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function isoToRu(iso: string): string {
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}.${month}.${year}` : "";
}

/**
 * A date that can be typed in full ("12.05.1952") or partly ("1952"), with a
 * calendar button next to it. The button opens the device's own picker: a wheel
 * on iPhone, a calendar on Android and desktop browsers.
 */
export function DateField({ label, value, onChange, placeholder }: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      // Older browsers: the transparent date input under the button opens on tap.
    }
  }

  return (
    <label className="grid gap-1">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <div className="relative">
        <input
          className="field pr-12"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,/\s-]/g, ""))}
          onBlur={() => onChange(tidyDateText(value))}
          placeholder={placeholder ?? "дд.мм.гггг или год"}
        />
        <span className="absolute inset-y-1 right-1 w-10">
          <button
            type="button"
            aria-label={`${label}: выбрать в календаре`}
            className="flex h-full w-full items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            onClick={openPicker}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </button>
          <input
            ref={pickerRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            min="1700-01-01"
            max={today}
            value={toIsoForPicker(value)}
            onClick={openPicker}
            onChange={(event) => {
              const picked = isoToRu(event.target.value);
              if (picked) onChange(picked);
            }}
          />
        </span>
      </div>
    </label>
  );
}
