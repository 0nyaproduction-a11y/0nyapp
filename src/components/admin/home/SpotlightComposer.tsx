/**
 * C08B-06: SpotlightComposer.
 *
 * Keeps Spotlight visually distinct from ordinary Home rows.
 * Does NOT mix Spotlight controls into the row editor hierarchy.
 * Reduces unnecessary vertical footprint while preserving all current
 * controls: enabled toggle, featured title selection, badge, headline.
 *
 * Spotlight business logic is NOT changed — only the operator UI is
 * compacted and separated.
 */

"use client";

import { useState, useEffect } from "react";
import type { ContentItem } from "@/data/content";
import type { SpotlightConfig, SpotlightFormState, RowWarning } from "@/lib/home/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { confirmUnsavedChanges } from "@/lib/home/dirty-state";
import { SubmittingButton } from "@/components/home/ui/States";
import { saveSpotlight } from "@/lib/home/actions";

type SpotlightComposerProps = {
  spotlight: SpotlightConfig & { warnings: RowWarning[] };
  catalog: ContentItem[];
  isSpotlightExpanded: boolean;
  onToggleSpotlightExpand: () => void;
  onSpotlightSaved: () => void;
  onSpotlightCollapseBlocked: () => void;
};

export function SpotlightComposer({
  spotlight,
  catalog,
  isSpotlightExpanded,
  onToggleSpotlightExpand,
  onSpotlightSaved,
  onSpotlightCollapseBlocked,
}: SpotlightComposerProps) {
  const [formState, setFormState] = useState<SpotlightFormState>({
    enabled: spotlight.enabled,
    featuredSlug: spotlight.featuredSlug,
    badge: spotlight.badge ?? "",
    headline: spotlight.headline ?? "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isSpotlightExpanded) {
      setFormState({
        enabled: spotlight.enabled,
        featuredSlug: spotlight.featuredSlug,
        badge: spotlight.badge ?? "",
        headline: spotlight.headline ?? "",
      });
    }
  }, [spotlight, isSpotlightExpanded]);

  // C08B-01: dirty check for Spotlight
  const isDirty =
    formState.enabled !== spotlight.enabled ||
    formState.featuredSlug !== spotlight.featuredSlug ||
    formState.badge !== (spotlight.badge ?? "") ||
    formState.headline !== (spotlight.headline ?? "");

  async function handleSave() {
    setIsSubmitting(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const result = await saveSpotlight(formState);

      if (result.success) {
        setSaveSuccess("Saved");
        onSpotlightSaved();
        setTimeout(() => setSaveSuccess(null), 3000);
      } else if (result.error) {
        // C08B-01: Failed save keeps dirty
        setSaveError(result.error);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save spotlight.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleToggleExpand = () => {
    if (isSpotlightExpanded && isDirty) {
      const confirmed = confirmUnsavedChanges(
        "Spotlight has unsaved changes. Discard changes and collapse?",
      );

      if (!confirmed) {
        onSpotlightCollapseBlocked();
        return;
      }
    }

    onToggleSpotlightExpand();
  };

  return (
    <section className="border-2 border-teal/20 bg-soft/30">
      {/* Compact Spotlight header — visually distinct from rows */}
      <div
        className={`
          flex cursor-pointer items-center justify-between gap-2 border-b border-teal/10
          bg-gradient-to-r from-teal/5 to-transparent px-4 py-2.5
          transition-colors
          ${isSpotlightExpanded ? "hover:border-teal/20" : "hover:bg-teal/5"}
        `}
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggleExpand();
          }
        }}
        aria-label={isSpotlightExpanded ? "Collapse Spotlight" : "Expand Spotlight"}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-teal">
            Spotlight
          </span>
          <span
            className={`
              border border-teal/30 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-teal
            `}
          >
            {spotlight.featuredSlug
              ? catalog.find((c) => c.slug === spotlight.featuredSlug)?.title ??
                spotlight.featuredSlug
              : "Auto"}
          </span>
          {spotlight.warnings.length > 0 ? (
            <Icon
              name="alert-triangle"
              className="h-4 w-4 text-amber-400"
              title={spotlight.warnings[0]?.label ?? "Warning"}
            />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {spotlight.enabled ? (
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-teal/70">
              Enabled
            </span>
          ) : (
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-bone/50">
              Disabled
            </span>
          )}
          <Icon
            name={isSpotlightExpanded ? "chevron-down" : "chevron-right"}
            className="h-4 w-4 text-bone/50"
          />
        </div>
      </div>

      {/* Expanded editor — compact, all controls preserved */}
      {isSpotlightExpanded ? (
        <div className="p-4 sm:p-5">
          {/* Row warnings */}
          {spotlight.warnings.length > 0 ? (
            <div className="mb-3 border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              {spotlight.warnings.map((warning) => (
                <div key={warning.code} className="flex items-start gap-1.5">
                  <Icon
                    name="alert-triangle"
                    className="mt-0.5 h-3.5 w-3.5 text-amber-400"
                  />
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-amber-400/80">
                    {warning.label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Save success */}
          {saveSuccess ? (
            <div className="mb-3 border border-teal/30 bg-teal/5 px-3 py-2">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-teal">
                {saveSuccess}
              </p>
            </div>
          ) : null}

          {/* Save error — C08B-01: failed save keeps dirty */}
          {saveError ? (
            <div className="mb-3 border border-red-500/30 bg-red-500/5 px-3 py-2">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-red-400">
                {saveError}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-3.5">
              {/* Enabled toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      enabled: !prev.enabled,
                    }));
                    setSaveError(null);
                    setSaveSuccess(null);
                  }}
                  aria-pressed={formState.enabled}
                  className={`
                    inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.12em] transition
                    ${
                      formState.enabled
                        ? "border-teal/40 text-teal"
                        : "border-bone/10 text-bone/50 hover:border-bone/25"
                    }
                  `}
                >
                  <Icon
                    name={formState.enabled ? "eye" : "eye-off"}
                    className="h-3 w-3"
                  />
                  {formState.enabled ? "Enabled on Home" : "Disabled on Home"}
                </button>
              </div>

              {/* Featured title selector — compact, no giant cards */}
              <label className="grid gap-1">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/60">
                  Featured title
                </span>
                <div className="relative">
                  <select
                    value={formState.featuredSlug ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        featuredSlug: e.target.value || null,
                      }))
                    }
                    className={`
                      w-full appearance-none border border-bone/10 bg-surface px-3 py-2 pr-8 text-base text-bone outline-none
                      focus:border-teal
                      ${isDirty ? "border-teal/40" : ""}
                    `}
                    aria-label="Featured title"
                  >
                    <option value="">Auto (first featured)</option>
                    {catalog.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevron-down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-bone/40 pointer-events-none"
                  />
                </div>
              </label>

              {/* Badge override */}
              <label className="grid gap-1">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/60">
                  Badge (optional)
                </span>
                <input
                  type="text"
                  value={formState.badge}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, badge: e.target.value }))
                  }
                  className="w-full border border-bone/10 bg-surface px-3 py-2 text-base text-bone outline-none focus:border-teal"
                  placeholder="e.g. Vertical original"
                  aria-label="Badge label"
                />
              </label>

              {/* Headline override */}
              <label className="grid gap-1">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/60">
                  Headline (optional)
                </span>
                <input
                  type="text"
                  value={formState.headline}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, headline: e.target.value }))
                  }
                  className="w-full border border-bone/10 bg-surface px-3 py-2 text-base text-bone outline-none focus:border-teal"
                  placeholder="Custom headline"
                  aria-label="Headline override"
                />
              </label>
            </div>

            {/* Save / Discard */}
            <div className="flex flex-col gap-2 sm:items-end">
              <SubmittingButton
                isSubmitting={isSubmitting}
                onClick={handleSave}
                disabled={!isDirty}
                ariaLabel="Save spotlight"
              >
                <Icon name="save" className="h-4 w-4" />
                Save
              </SubmittingButton>

              <Button
                variant="ghost"
                onClick={() => {
                  if (isDirty) {
                    const confirmed = confirmUnsavedChanges(
                      "Discard Spotlight changes?",
                    );

                    if (!confirmed) {
                      return;
                    }
                  }

                  setFormState({
                    enabled: spotlight.enabled,
                    featuredSlug: spotlight.featuredSlug,
                    badge: spotlight.badge ?? "",
                    headline: spotlight.headline ?? "",
                  });
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
                aria-label="Discard changes"
              >
                <Icon name="x" className="h-4 w-4" />
                Discard
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
