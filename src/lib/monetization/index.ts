/**
 * Monetization observation — public module entry point (M1.1).
 *
 * Exposes the event contracts and validation used by the Monetization
 * Observation Bridge. M1.1 is contracts + validation only:
 *   - no database table is created,
 *   - no impression route is added,
 *   - no 0nya runtime / adapter is connected,
 *   - no production authority is granted.
 *
 * Architecture references:
 *   - docs/architecture/07 App Integration/Story/STORY_INTEGRATION_DATA_CONTRACT_v0.1.md
 *   - docs/architecture/07 App Integration/Monetization/MONETIZATION_OBSERVATION_BRIDGE_v0.2.md
 */

export * from "./events.ts";
export * from "./validation.ts";
