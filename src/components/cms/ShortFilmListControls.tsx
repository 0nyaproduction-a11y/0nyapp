"use client";

type ShortFilmStatusOption = { label: string; value: string };

type ShortFilmSearchInputProps = {
  initialSearch: string;
};

type ShortFilmStatusSelectProps = {
  initialStatus: string;
  statusOptions: ShortFilmStatusOption[];
};

/**
 * CMS-C08B-07 blocker fix: the short-films search/status controls must live in
 * a Client Component — inline onChange handlers on the Server Component page
 * throw "Event handlers cannot be passed to Client Component props" during
 * SSR (React #441 → C08B-03 error boundary on every render).
 *
 * Behavior is identical to the previous inline handlers: the URL query keeps
 * carrying search/status, page resets to 1, and the page reloads so the
 * server re-renders with the new filter values.
 */
export function ShortFilmSearchInput({ initialSearch }: ShortFilmSearchInputProps) {
  return (
    <input
      type="text"
      defaultValue={initialSearch}
      placeholder="Title or slug"
      className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      onChange={(e) => {
        const value = e.target.value;
        const url = new URL(window.location.href);
        if (value) {
          url.searchParams.set("search", value);
        } else {
          url.searchParams.delete("search");
        }
        url.searchParams.set("page", "1");
        window.history.replaceState({}, "", url.toString());
        window.location.reload();
      }}
    />
  );
}

export function ShortFilmStatusSelect({ initialStatus, statusOptions }: ShortFilmStatusSelectProps) {
  return (
    <select
      value={initialStatus}
      onChange={(e) => {
        const value = e.target.value;
        const url = new URL(window.location.href);
        if (value && value !== "all") {
          url.searchParams.set("status", value);
        } else {
          url.searchParams.delete("status");
        }
        url.searchParams.set("page", "1");
        window.history.replaceState({}, "", url.toString());
        window.location.reload();
      }}
      className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
    >
      {statusOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
