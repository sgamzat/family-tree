"use client";

import { useEffect, useState } from "react";
import type { Gender, SearchHit } from "@/lib/names";
import { api } from "@/lib/api";

export function usePersonSearch(options: {
  query?: string;
  lastName?: string;
  firstName?: string;
  patronymic?: string;
  gender?: Gender;
  excludeIds?: string[];
  nearId?: string;
  role?: string;
  enabled?: boolean;
}) {
  const query = options.query ?? "";
  const lastName = options.lastName ?? "";
  const firstName = options.firstName ?? "";
  const patronymic = options.patronymic ?? "";
  const gender = options.gender;
  const excludeKey = (options.excludeIds ?? []).join(",");
  const nearId = options.nearId ?? "";
  const role = options.role ?? "";
  const enabled = options.enabled ?? true;
  const hasQuery =
    enabled &&
    (query.trim().length >= 2 ||
      lastName.trim().length >= 2 ||
      firstName.trim().length >= 2 ||
      patronymic.trim().length >= 2);
  const requestKey = [
    query,
    lastName,
    firstName,
    patronymic,
    gender ?? "",
    excludeKey,
    nearId,
    role,
  ].join("|");

  const [result, setResult] = useState<{ key: string; hits: SearchHit[] }>({
    key: "",
    hits: [],
  });

  useEffect(() => {
    if (!hasQuery) return;

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (lastName) params.set("lastName", lastName);
    if (firstName) params.set("firstName", firstName);
    if (patronymic) params.set("patronymic", patronymic);
    if (gender) params.set("gender", gender);
    if (nearId) params.set("near", nearId);
    if (role) params.set("role", role);
    for (const id of excludeKey.split(",").filter(Boolean)) {
      params.append("exclude", id);
    }

    const timer = window.setTimeout(async () => {
      try {
        const data = await api<{ people: SearchHit[] }>(
          `/api/people?${params.toString()}`,
        );
        setResult({ key: requestKey, hits: data.people });
      } catch {
        setResult({ key: requestKey, hits: [] });
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [
    hasQuery,
    requestKey,
    query,
    lastName,
    firstName,
    patronymic,
    gender,
    excludeKey,
    nearId,
    role,
  ]);

  const ready = result.key === requestKey;
  return {
    hits: hasQuery && ready ? result.hits : [],
    loading: hasQuery && !ready,
  };
}
