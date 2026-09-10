"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, FormEvent, ChangeEvent } from "react";

type SeriesListFiltersProps = {
  initialSearch: string;
  initialStatus: string;
  statusOptions: { label: string; value: string }[];
  totalCount: number;
  filteredCount: number;
};

export function SeriesListFilters({
  initialSearch,
  initialStatus,
  statusOptions,
  totalCount,
  filteredCount,
}: SeriesListFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus || "all");

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const trimmed = search.trim();
      if (trimmed) params.set("search", trimmed);
      if (status && status !== "all") params.set("status", status);
      params.set("page", "1");
      router.push(`/admin/series?${params.toString()}`);
    },
    [router, search, status]
  );

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-3 border border-bone/10 bg-bone/[0.03] p-4 sm:grid-cols-3">
      <label className="block space-y-1.5">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Search</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title or slug"
          className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      <div className="flex items-end">
        <div className="w-full text-right">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Results</p>
          <p className="mt-1 text-sm text-bone/70">
            {totalCount} total &bull; {filteredCount} {filteredCount === 1 ? "match" : "matches"}
          </p>
        </div>
      </div>
    </form>
  );
}