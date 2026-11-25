# ADR-0009: Caching Strategy

- **Status:** Proposed
- **Date:** 2026-11-25
- **Deciders:** Jana

## Context

Qaryati uses the external Nominatim geocoding service to obtain village coordinates when they are not provided by contributors.

Nominatim limits requests to one request per second. Repeated geocoding queries can introduce unnecessary latency and external API calls.

However, other application data requires up-to-date information, especially records associated with verification, provenance, and user-specific information.

## Options considered

1. **No caching:** Keeps the implementation simple but increases external API calls and response times for repeated geocoding queries.

2. **Selective in-memory caching:** Caches geocoding results while keeping application data fresh. It requires no additional infrastructure or dependencies.

3. **Shared or broader caching:** A shared cache such as Redis could support multiple API instances. A short-lived cache of 30–60 seconds for governorate lists was also considered. However, these approaches introduce additional infrastructure or cache invalidation complexity without a demonstrated current need.

## Decision

We use selective in-memory caching for geocoding results only.

### Cached data

The `NominatimGeocodingAdapter` in `src/geocoding/adapters/nominatim-geocoding.adapter.ts` stores results in a `Map`.

- Cache keys are normalized by trimming whitespace and converting queries to lowercase.
- Successful geocoding results containing latitude, longitude, and display name are cached.
- Not-found results are cached as `null`.
- Thrown errors, including network failures, timeouts, HTTP errors, and invalid coordinates, are not cached.
- Blank queries return `null` without contacting Nominatim.
- Cache entries remain in memory until the API process restarts.

This reduces repeated external requests, improves response times for repeated queries, and helps respect Nominatim's usage limits.

### Data that is not cached

- **Verification queue, population records, village names, and heritage facts:** These records contain verification statuses and provenance information. Stale data could misrepresent their current state.
- **User-specific data and audit logs:** These require current information and must respect user-specific access restrictions.
- **Village list and details:** These endpoints already meet the performance target of p95 below 500 ms, with measured p95 values of 135.7 ms and 202.6 ms, respectively. Therefore, additional caching is not currently justified.
- **Governorate lists:** Although governorate data changes infrequently, a short-lived cache is not necessary under the current workload.

## Consequences

### Positive

- Fewer external geocoding requests.
- Faster responses for repeated geocoding queries.
- No additional caching infrastructure or dependencies.
- Fresh verification and provenance information.

### Negative / trade-offs accepted

- The cache is local to each API process and is cleared on restart.
- Multiple API instances do not share cached results.
- The cache has no maximum size or expiration policy. This is accepted for the expected limited number of village queries.
- Cached results, including not-found results, may become outdated.
- The per-process rate limiter does not guarantee compliance with Nominatim's aggregate request limit across multiple API instances.

### Follow-up work

- Monitor cache growth and memory usage as the application scales.
- Consider cache expiration and size limits if needed.
- Introduce a shared cache and coordinated rate limiting before scaling public Nominatim usage across multiple API instances.
