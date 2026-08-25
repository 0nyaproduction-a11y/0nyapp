// A tiny (4x160) pre-rendered vertical "black -> transparent" bitmap, stretched
// via <Image resizeMode="stretch"> to produce a genuinely smooth scrim fade for
// the player's top/bottom readability treatment.
//
// No gradient library (e.g. expo-linear-gradient) is installed in this app, and
// none may be added. Native bitmap scaling (bilinear) interpolates between the
// PNG's 160 gradient steps, avoiding the visible banding that stacked
// translucent-rectangle "bands" produced on physical devices.
//
// Regenerate by running a Node script that builds a grayscale+alpha PNG with an
// eased alpha falloff (see git history for the generator used to produce this).
export const TOP_DOWN_SCRIM_GRADIENT_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAACgCAQAAACBdQUNAAABKElEQVR42pXG6S8XcACA8ccRUu6i5A65j5L7mnu5RqbMMTGsjFZLyzCW1TCmZcyf682zfd/89ts8nzcP3IobcS2uxH/xT1yKC3EuzsSpOBF/xR9xLH6LI3EoDsS+2BO74pf4KXbED/FdfBNfxbbYEpvii/gsNsS6WBOrYkV8EstiSSyKBTEv5sRH8UHMihnxXkyLKTEpJsS4GBOj4p0YEcNiSAyKAdEv+kSv6BHdokt0ig7RLtpEq2gRzeKtaBJvxGvRKBpEvagTtaJGVIsqUSkqxCtRLspEqXipMCWiWBSJQlEg8hUmT7wQueK5wjwTOSJbYZ6KJyJLYTJFhsKkizSFSRUpCvNYYR4pTLJ4qDBJCpOoMAmKMA8UJl5h4hRhYhVtYhRt7tEdaqWSbYzQ3ckAAAAASUVORK5CYII=";
