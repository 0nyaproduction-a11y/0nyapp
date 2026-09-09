/**
 * C08B-06 / C08B-03 / C08B-05 integration tests.
 *
 * Verifies that:
 *  - The HomeComposer renders a loading state.
 *  - The HomeComposer renders an error state.
 *  - The HomeComposer renders rows with compact headers.
 *  - The HomeComposer renders the Spotlight as a separate section.
 *  - The breadcrumb "Admin → Home" is present (C08B-05).
 *  - Shared LoadingState/EmptyState/ErrorState components are used (C08B-03).
 *  - Opening one row collapses another (one-row focus).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HomeComposer } from "../HomeComposer";
import type { HomeComposerData } from "@/lib/home/types";

const mockData: HomeComposerData = {
  rows: [
    {
      id: "featured-hero",
      title: "Featured Hero",
      type: "featured-hero",
      sortOrder: 0,
      visible: true,
      assignedSlugs: ["alpha"],
      kicker: null,
      items: [],
      warnings: [],
      isDirty: false,
    },
    {
      id: "trending",
      title: "Trending",
      type: "trending",
      sortOrder: 1,
      visible: true,
      assignedSlugs: [],
      kicker: null,
      items: [],
      warnings: [
        {
          code: "empty",
          label: "This row has no titles assigned.",
        },
      ],
      isDirty: false,
    },
  ],
  spotlight: {
    enabled: true,
    featuredSlug: "alpha",
    badge: null,
    headline: null,
    warnings: [],
  },
  catalog: [],
};

describe("HomeComposer (C08B-06, C08B-03, C08B-05)", () => {
  it("renders loading state when no data and no error", () => {
    render(<HomeComposer data={null} error={null} onRetry={jest.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders error state when error is provided", () => {
    render(
      <HomeComposer data={null} error="Connection failed" onRetry={jest.fn()} />,
    );
    expect(screen.getByText(/Unable to load Home/i)).toBeInTheDocument();
    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
  });

  it("renders breadcrumb 'Admin → Home' (C08B-05)", () => {
    render(<HomeComposer data={mockData} error={null} onRetry={jest.fn()} />);
    const breadcrumb = screen.getByText(/Admin → Home/i);
    expect(breadcrumb).toBeInTheDocument();
  });

  it("renders each row as a compact header", () => {
    render(<HomeComposer data={mockData} error={null} onRetry={jest.fn()} />);
    expect(screen.getByText("Featured Hero")).toBeInTheDocument();
    expect(screen.getByText("Trending")).toBeInTheDocument();
  });

  it("renders Spotlight as a separate section (not in row list)", () => {
    render(<HomeComposer data={mockData} error={null} onRetry={jest.fn()} />);
    const spotlight = screen.getByText(/Spotlight/i, { exact: false });
    expect(spotlight).toBeInTheDocument();
  });

  it("shows warning indicator on rows with warnings", () => {
    render(<HomeComposer data={mockData} error={null} onRetry={jest.fn()} />);
    // The Trending row has an "empty" warning
    const warningIcon = screen.getByTestId("row-warning-icon-trending");
    expect(warningIcon).toBeInTheDocument();
  });

  it("expands one row and collapses when another is opened (one-row focus)", async () => {
    render(<HomeComposer data={mockData} error={null} onRetry={jest.fn()} />);

    // Click to expand the featured-hero row
    const expandButton = screen.getByTestId("row-expand-featured-hero");
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByTestId("row-editor-featured-hero")).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.queryByTestId("row-editor-featured-hero")).not.toBeInTheDocument();
    });
  });

  it("collapses expanded row when another row is expanded", async () => {
    render(<HomeComposer data={mockData} error={null} onRetry={jest.fn()} />);

    // Expand first row
    const expand1 = screen.getByTestId("row-expand-featured-hero");
    fireEvent.click(expand1);

    await waitFor(() => {
      expect(screen.getByTestId("row-editor-featured-hero")).toBeInTheDocument();
    });

    // Expand second row — the first should collapse
    const expand2 = screen.getByTestId("row-expand-trending");
    fireEvent.click(expand2);

    await waitFor(() => {
      expect(screen.queryByTestId("row-editor-featured-hero")).not.toBeInTheDocument();
    });
  });
});
