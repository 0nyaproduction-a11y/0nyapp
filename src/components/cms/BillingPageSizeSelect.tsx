"use client";

type BillingPageSizeSelectProps = {
  pageSize: number;
  options: number[];
};

/**
 * CMS-C08B-07 blocker fix: the billing page-size control must live in a
 * Client Component — an inline onChange on a <select> inside the Server
 * Component page throws "Event handlers cannot be passed to Client Component
 * props" during SSR (React #441 → C08B-03 error boundary on every render).
 *
 * Behavior is identical to the previous inline handler: sets pageSize, resets
 * to page 1, and navigates via window.location.search.
 */
export function BillingPageSizeSelect({ pageSize, options }: BillingPageSizeSelectProps) {
  return (
    <select
      value={pageSize}
      onChange={(e) => {
        const params = new URLSearchParams();
        params.set("pageSize", e.target.value);
        params.set("page", "1");
        window.location.search = params.toString();
      }}
      className="border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
    >
      {options.map((size) => (
        <option key={size} value={size}>{size}/page</option>
      ))}
    </select>
  );
}
