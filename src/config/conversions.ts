// Which Meta `action_type` values count as a "conversion".
//
// Configurable via env META_CONVERSION_ACTIONS (comma-separated), otherwise the
// default below (purchase + lead). Keep this consistent so trends stay comparable.
//
// Note: Meta's aggregated "purchase"/"lead" usually already fold in their pixel
// variants (e.g. offsite_conversion.fb_pixel_purchase) — listing both can double
// count. Pick the set that matches how your account reports.
export const CONVERSION_ACTION_TYPES: string[] = process.env.META_CONVERSION_ACTIONS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean) ?? ["purchase", "lead"];
