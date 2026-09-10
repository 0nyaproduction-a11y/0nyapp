"use client";

import { useRouter } from "next/navigation";
import { FormEvent, ChangeEvent } from "react";
import { useState, useCallback } from "react";
import { mediaListPath } from "@/lib/routes";

type MediaListFiltersProps = {
  initialSearch: string;
  initialStatus: string;
  initialPage: number;
  initialPageSize: number;
  totalCount: number;
  filteredCount: number;
  pageSizeOpts: number[];
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function MediaListFilters({
  initialSearch,
  initialStatus,
  initialPage,
  initialPageSize,
  totalCount,
  filteredCount,
  pageSizeOpts,
  onSearchChange,
  onStatusChange,
  onPageChange,
  onPageSizeChange,
}: MediaListFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus || "all");
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const handleSearchSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = search.trim();
      onSearchChange(trimmed);
      setPage(1);
      const params = new URLSearchParams();
      if (trimmed) params.set("search", trimmed);
      if (status && status !== "all") params.set("status", status);
      router.push(`${mediaListPath}?${params.toString()}`);
    },
    [router, search, status]
  );

  const handleStatusChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setStatus(value);
      onStatusChange(value);
      setPage(1);
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      router.push(`${mediaListPath}?${params.toString()}`);
    },
    [status]
  );

  const handlePageChange = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const value = page - 1;
      onPageChange(value);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status && status !== "all") params.set("status", status);
      params.set("page", String(page));
      router.push(`${mediaListPath}?${params.toString()}`);
    },
    [router, search, status, page]
  );

  const handlePageSizeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = Number(e.target.value);
      setPageSize(value);
      onPageSizeChange(value);
      setPage(1);
      const params = new URLSearchParams();
      params.set("pageSize", e.target.value);
      params.set("page", "1");
      router.push(`${mediaListPath}?${params.toString()}`);
    },
    [pageSize]
  );

  return (
    <form onSubmit={handleSearchSubmit} className="mt-8 grid gap-3 border border-bone/10 bg-bone/[0.03] p-4 sm:grid-cols-3">
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
          onChange={handleStatusChange}
          className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          {pageSizeOpts.map((opt) => (
            <option key={opt} value={opt}>{opt}/page</option>
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