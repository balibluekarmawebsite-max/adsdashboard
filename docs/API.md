# Reporting API (`/api/v1`)

A read-only JSON feed of the ads data, for pulling into another dashboard or BI
tool. Everything returned is the same aggregation the dashboard renders, so the
two never disagree.

- **Base URL:** `https://ads.bluekarmasecrets.com`
- **Auth:** an API key, sent on every request.
- **Methods:** `GET` only. No endpoint ever changes data.

## Authentication

Set a secret on the server in `.env` (comma-separate to issue more than one, e.g.
for rotation):

```
REPORTING_API_KEY=<generate with: openssl rand -hex 32>
```

Reload the app after setting it (`pm2 reload ads-dashboard`). Then present the key
on every call, either way:

```
Authorization: Bearer <key>
# or
X-API-Key: <key>
```

Responses: `401` invalid/missing key · `503` the API isn't enabled (no key set on
the server) · `400` bad parameters. Errors are JSON: `{ "error": "…" }`.

> Treat the key like a password — it unlocks spend and revenue figures. Keep it
> server-side on the consuming system; never embed it in a browser/front-end.

## Date range

Two ways, on the endpoints that take a range:

- Explicit: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive).
- Named period: `?period=<name>` — one of
  `last-week` (default; the previous complete Mon–Sun), `this-week`, `last-7`,
  `last-30`, `this-month`, `last-month`. Computed in the reporting timezone
  (Asia/Makassar).

Scope (optional): `?property=<code|all>` (default `all`) and
`?platform=<google|meta|all>` (default `all`).

## Endpoints

### `GET /api/v1/report`

The full dataset for a range and scope.

```bash
curl -s "https://ads.bluekarmasecrets.com/api/v1/report?period=last-week" \
  -H "Authorization: Bearer $REPORTING_API_KEY"
```

```jsonc
{
  "meta": {
    "generatedAt": "2026-10-07T01:00:00.000Z",
    "from": "2026-09-28", "to": "2026-10-04", "days": 7,
    "comparison": { "from": "2026-09-21", "to": "2026-09-27" },
    "property": "all", "platform": "all",
    "currency": "IDR", "mixedCurrency": false,
    "note": "KPIs for property=all cover the top-level hotels only …"
  },
  "kpis": {
    "spend": 20615450, "reach": 410233, "impressions": 2553807, "clicks": 62636,
    "conversions": 2027, "conversionValue": 0,
    "ctr": 0.0245, "cpc": 329.1, "cpm": 8073.4, "cvr": 0.032, "roas": 8.88,
    "revenue": 212073896,
    "changePct": { "spend": -15.4, "clicks": -49.5, "revenue": -5.3, "…": 0 }
  },
  "platforms": [ { "platform": "google", "spend": 10223379, "reach": 0, "impressions": 1, "clicks": 1, "conversions": 2027, "roas": 3.07, "…": 0 } ],
  "properties": [ { "propertyId": "…", "code": "BKDS", "name": "Blue Karma Dijiwa Seminyak", "spend": 20615450, "reach": 410233, "conversions": 2027, "roas": 8.88, "revenue": 212073896, "…": 0 } ],
  "campaigns": [ { "campaignId": "…", "campaignName": "BKDS-Awareness…", "platform": "google", "spend": 2970969, "reach": 0, "clicks": 7534, "conversions": 1760, "roas": 10.58, "…": 0 } ],
  "timeseries": [ { "date": "2026-09-28", "spend": 749924, "reach": 0, "impressions": 1, "clicks": 1, "conversions": 1, "…": 0 } ]
}
```

Notes:
- **`kpis` for `property=all` cover the top-level hotels only** (same as the
  dashboard's "All hotels"). Outlets (restaurant/spa/wellness) and the top-level
  **WELLNESS BLUE KARMA** unit are listed in `properties[]` — sum them yourself if
  you want a grand total.
- **Money** (`spend`, `cpc`, `cpm`, `revenue`, `conversionValue`) is in `meta.currency`
  (IDR). `mixedCurrency: true` means the scope spans more than one currency and the
  totals are unconverted.
- **`roas`/`cpc`/`ctr`/`cpm`/`cvr`** can be `null` when the denominator is zero.
- **`reach`** is Meta-only (Google reports 0) and is an approximate multi-day total
  (unique people don't add up across days). `revenue` is blended (not per-platform),
  so it's `null` when `platform` is `google` or `meta`.
- Only campaigns switched **on** for the report are included (same as the dashboard).

### `GET /api/v1/properties`

The property catalogue — map codes to names and see the hierarchy.

```bash
curl -s "https://ads.bluekarmasecrets.com/api/v1/properties" \
  -H "Authorization: Bearer $REPORTING_API_KEY"
```

```jsonc
{ "generatedAt": "…", "properties": [
  { "code": "BKDS", "name": "Blue Karma Dijiwa Seminyak", "kind": "hotel", "parentCode": null },
  { "code": "BKDS-SPA", "name": "Mudara Spa", "kind": "spa", "parentCode": "BKDS" },
  { "code": "BKW", "name": "WELLNESS BLUE KARMA", "kind": "wellness", "parentCode": null }
] }
```

### `GET /api/v1/revenue`

Every revenue entry (monthly + date-range), each with its ad spend and ROAS.

```bash
curl -s "https://ads.bluekarmasecrets.com/api/v1/revenue" \
  -H "Authorization: Bearer $REPORTING_API_KEY"
```

```jsonc
{
  "generatedAt": "…",
  "monthly": [ { "propertyCode": "BKDS", "year": 2026, "month": 8, "amount": 212073896, "currency": "IDR", "spend": 23874867, "roas": 8.88 } ],
  "periods": [ { "propertyCode": "BKDS", "startDate": "2026-08-21", "endDate": "2026-08-27", "amount": 50000000, "currency": "IDR", "spend": 5677699, "roas": 8.81 } ]
}
```

## Weekly pull — example

Fetch last week once a week (cron on the consuming system):

```bash
curl -s "https://ads.bluekarmasecrets.com/api/v1/report?period=last-week" \
  -H "Authorization: Bearer $REPORTING_API_KEY" -o last-week.json
```

All timestamps are ISO-8601 UTC; dates are `YYYY-MM-DD`.
