"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Подсказки для поля «Занятие» — то, что уже внесли другие. */
export function useOccupations(): string[] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    api<{ occupations: string[] }>("/api/occupations")
      .then((data) => {
        if (!cancelled) setList(data.occupations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return list;
}
