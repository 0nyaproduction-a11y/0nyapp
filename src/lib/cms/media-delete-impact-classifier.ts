// Pure, I/O-free classifier for the M6A Smart Delete impact report.
//
// Fail-closed contract: any unprovable or unsettled input yields UNKNOWN with
// deletion disabled. Only a complete dependency scan with zero incoming
// references, no shared provider reference, and no retention records can yield
// SAFE. SAFE is advisory — M6A never deletes; execution is a separate,
// authorized M6B step that must re-verify before acting.

export type DeleteImpactClassification =
  | "SAFE"
  | "REPLACE_FIRST"
  | "BLOCKED"
  | "SHARED"
  | "RETENTION_PROTECTED"
  | "UNKNOWN";

// Live provider (Mux) state as proven by inspection. MISSING means absence was
// proven (direct provider 404s or no stored provider references at all);
// UNPROVEN means the provider could not be consulted and must fail closed.
export type DeleteImpactLiveMuxState =
  | "READY"
  | "PROCESSING"
  | "FAILED"
  | "MISSING"
  | "UNPROVEN";

export type DeleteImpactSupabaseState = "ready" | "processing" | "failed" | "pending";

export type DeleteClassificationInput = {
  assetExists: boolean;
  supabaseState: DeleteImpactSupabaseState;
  hasPublishedEpisodeRefs: boolean;
  hasPublishedShortFilmRefs: boolean;
  hasAnyEpisodeRefs: boolean;
  hasAnyPreviewRefs: boolean;
  hasAnyShortFilmRefs: boolean;
  hasDerivedChildren: boolean;
  hasSubtitleTracks: boolean;
  hasSharedProviderRef: boolean;
  hasRetentionHistory: boolean;
  hasHomePublishingImpact: boolean;
  liveMuxState: DeleteImpactLiveMuxState;
  scanComplete: boolean;
  retentionProvenance: "scanned" | "absent" | "failed";
};

export type DeleteClassificationVerdict = {
  primary: DeleteImpactClassification;
  safeForDeletion: boolean;
  blockers: string[];
  warnings: string[];
  replacements: string[];
};

// ---------------------------------------------------------------------------
// Serializable Delete Impact Report contract (rendered by Media Asset Detail).
// `null` totals mean the corresponding domain was NOT scanned (fail-closed).
// ---------------------------------------------------------------------------

export type DeleteImpactRefItem = {
  id: string;
  label: string;
  published: boolean | null;
};

export type DeleteImpactRefSummary = {
  total: number | null;
  published: number | null;
  items: DeleteImpactRefItem[];
};

export type DeleteImpactReportDetails = {
  episodeRefs: DeleteImpactRefSummary;
  previewRefs: DeleteImpactRefSummary;
  shortFilmRefs: DeleteImpactRefSummary;
  derivedChildren: DeleteImpactRefSummary;
  subtitleTracks: {
    total: number | null;
    breakdown: {
      ready: number | null;
      processing: number | null;
      pending: number | null;
      failed: number | null;
      deleted: number | null;
    };
  };
  sharedProviderRefs: DeleteImpactRefSummary;
  retention: {
    present: boolean | null;
    scanned: boolean;
    items: { table: string }[];
    sources: {
      table: string;
      provenance: "scanned" | "absent" | "failed";
      count: number | null;
      error: string | null;
    }[];
  };
  homeImpact: {
    present: boolean | null;
    items: {
      rowId: string;
      rowTitle: string;
      rowRole: string;
      enabled: boolean;
      contentType: string;
    }[];
  };
  liveMux: {
    state: DeleteImpactLiveMuxState;
    assetStatus: string | null;
    uploadStatus: string | null;
    assetExists: boolean | null;
    uploadExists: boolean | null;
    failureMessage: string | null;
  };
  supabaseState: DeleteImpactSupabaseState | null;
  scanComplete: boolean;
  scanErrors: string[];
  failClosed: boolean;
};

export type DeleteImpactReport = {
  assetId: string | null;
  generatedAt: string;
  classification: DeleteImpactClassification;
  // True only when the classification is SAFE under a complete scan. Even then
  // M6A never deletes — this is advisory for the authorized M6B executor.
  deletionEnabled: boolean;
  blockers: string[];
  warnings: string[];
  replacements: string[];
  details: DeleteImpactReportDetails;
};

export function classifyDeleteImpact(
  input: DeleteClassificationInput,
): DeleteClassificationVerdict {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const replacements: string[] = [];

  if (!input.assetExists) {
    return {
      primary: "UNKNOWN",
      safeForDeletion: false,
      blockers: ["Asset row was not found in Supabase — nothing to evaluate."],
      warnings,
      replacements,
    };
  }

  if (!input.scanComplete) {
    return {
      primary: "UNKNOWN",
      safeForDeletion: false,
      blockers: [
        "Dependency scan is incomplete — deletion impact cannot be proven, so deletion is disabled.",
      ],
      warnings,
      replacements,
    };
  }

  // Retention scan provenance: only a fully-scanned retention result may
  // contribute to classification. If any retention source is absent (table not
  // yet installed) or failed (query errored), we treat the whole retention
  // domain as unproven and fail closed with UNKNOWN.
  if (input.retentionProvenance === "absent") {
    return {
      primary: "UNKNOWN",
      safeForDeletion: false,
      blockers: [
        "Retention source is absent when expected by policy — scan incomplete, deletion disabled (fail-closed).",
      ],
      warnings,
      replacements,
    };
  }
  if (input.retentionProvenance === "failed") {
    return {
      primary: "UNKNOWN",
      safeForDeletion: false,
      blockers: [
        "Retention source query failed — scan incomplete, deletion disabled (fail-closed).",
      ],
      warnings,
      replacements,
    };
  }

  // Published content is live consumer surface: never deletable. This outranks
  // every other dependency signal.
  if (input.hasPublishedEpisodeRefs || input.hasPublishedShortFilmRefs) {
    blockers.push(
      "Asset is referenced by published content (episodes/short films); deletion would break live playback.",
    );
    return { primary: "BLOCKED", safeForDeletion: false, blockers, warnings, replacements };
  }

  if (input.hasRetentionHistory) {
    blockers.push(
      "Asset has retention-protected records (quarantine/ledger history); deletion is not permitted.",
    );
    return { primary: "RETENTION_PROTECTED", safeForDeletion: false, blockers, warnings, replacements };
  }

  // Shared provider reference: the provider asset backs other Supabase rows.
  if (input.hasSharedProviderRef) {
    warnings.push(
      "Provider reference is shared with other media assets; the provider asset must not be deleted while shared.",
    );
    return { primary: "SHARED", safeForDeletion: false, blockers, warnings, replacements };
  }

  // Draft/editable references: reassign or remove them before any deletion.
  const refParts: string[] = [];
  if (input.hasAnyEpisodeRefs) refParts.push("episode media references");
  if (input.hasAnyPreviewRefs) refParts.push("episode preview references");
  if (input.hasAnyShortFilmRefs) refParts.push("short-film references");
  if (input.hasDerivedChildren) refParts.push("derived child assets");
  if (input.hasSubtitleTracks) refParts.push("related subtitle tracks");
  if (refParts.length > 0) {
    replacements.push(
      `Replace or remove the referencing records first: ${refParts.join(", ")}.`,
    );
    return { primary: "REPLACE_FIRST", safeForDeletion: false, blockers, warnings, replacements };
  }

  // Zero references but the provider is still mid-flight: the live state has
  // not settled, so the report is deferred rather than declared SAFE.
  if (input.liveMuxState === "PROCESSING") {
    blockers.push(
      "Live Mux asset is still processing — the provider state has not settled, so deletion impact cannot be final.",
    );
    return { primary: "UNKNOWN", safeForDeletion: false, blockers, warnings, replacements };
  }

  if (input.hasHomePublishingImpact) {
    warnings.push(
      "Referencing content is represented in enabled Home rows; changes to it alter Home publishing input.",
    );
  }
  if (input.liveMuxState === "MISSING") {
    warnings.push(
      "Live Mux asset is missing (no provider asset/upload exists for the stored references).",
    );
  } else if (input.liveMuxState === "FAILED") {
    warnings.push("Live Mux asset is in a failed/errored state.");
  } else if (input.liveMuxState === "UNPROVEN") {
    warnings.push("Live Mux state could not be verified.");
  }

  return { primary: "SAFE", safeForDeletion: true, blockers, warnings, replacements };
}
