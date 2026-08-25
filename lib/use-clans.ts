"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ClanDTO } from "@/lib/names";

export function useClans() {
  const [clans, setClans] = useState<ClanDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<{ clans: ClanDTO[] }>("/api/clans")
      .then((data) => {
        if (!cancelled) setClans(data.clans);
      })
      .catch(() => {
        if (!cancelled) setClans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function addClan(clan: ClanDTO) {
    setClans((current) =>
      current.some((item) => item.id === clan.id)
        ? current.map((item) => (item.id === clan.id ? clan : item))
        : [...current, clan].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    );
  }

  return { clans, loading, addClan };
}
