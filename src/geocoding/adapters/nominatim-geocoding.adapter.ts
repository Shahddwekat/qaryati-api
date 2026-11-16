
import type {
    GeocodingProvider,
    GeocodingResult,
} from '../interfaces/geocoding-provider.interface';

interface NominatimResponse {
    lat: string;
    lon: string;
    display_name: string;
}

export interface NominatimAdapterOptions {
    /** For tests: replaces the global fetch. */
    fetchFn?: typeof fetch;
    /** For tests: replaces the real waiting. */
    sleep?: (ms: number) => Promise<void>;
    /** Minimum gap between two requests to Nominatim (default 1100 ms). */
    minIntervalMs?: number;
    /** Wait before retry 1, retry 2, ... (default 500 ms, then 1 s). */
    retryDelaysMs?: number[];
}

class GeocodingHttpError extends Error {
    constructor(readonly status: number) {
        super(`Geocoding API failed: ${status}`);
        this.name = 'GeocodingHttpError';
    }
}

/** Temporary problems are worth another try: timeout, network error, 429, 5xx. */
function isRetryable(error: unknown): boolean {
    if (error instanceof GeocodingHttpError) {
        return error.status === 429 || error.status >= 500;
    }
    // Checked by name, not instanceof: the timeout error is a DOMException and
    // can come from another realm (for example inside Jest).
    const name = (error as { name?: unknown } | null)?.name;
    return (
        name === 'TimeoutError' ||
        name === 'AbortError' ||
        name === 'TypeError' // fetch network failure
    );
}

const defaultSleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

export class NominatimGeocodingAdapter
    implements GeocodingProvider {
    private readonly cache = new Map<
        string,
        GeocodingResult | null
    >();

    private readonly fetchFn: typeof fetch;
    private readonly sleep: (ms: number) => Promise<void>;
    private readonly minIntervalMs: number;
    private readonly retryDelaysMs: number[];

    constructor(
        private readonly userAgent: string,
        private readonly baseUrl =
            'https://nominatim.openstreetmap.org',
        private readonly timeoutMs = 3000,
        options: NominatimAdapterOptions = {},
    ) {
        // The global fetch is called lazily so jest.spyOn(globalThis, 'fetch') still works.
        this.fetchFn = options.fetchFn ?? ((...args) => fetch(...args));
        this.sleep = options.sleep ?? defaultSleep;
        this.minIntervalMs = options.minIntervalMs ?? 1100;
        this.retryDelaysMs = options.retryDelaysMs ?? [500, 1000];
    }

    async geocode(
        placeName: string,
    ): Promise<GeocodingResult | null> {
        const normalizedName = placeName.trim();

        if (!normalizedName) {
            return null;
        }

        const cacheKey = normalizedName.toLowerCase();

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) ?? null;
        }

        const url = new URL('/search', this.baseUrl);

        url.searchParams.set('q', normalizedName);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '1');
        const response = await this.fetchWithRetry(url.toString());

        const results =
            (await response.json()) as NominatimResponse[];

        if (!Array.isArray(results) || results.length === 0) {
            this.cache.set(cacheKey, null);
            return null;
        }

        const latitude = Number(results[0].lat);
        const longitude = Number(results[0].lon);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            throw new Error('Invalid geocoding coordinates');
        }

        const result: GeocodingResult = {
            latitude,
            longitude,
            displayName: results[0].display_name,
        };

        this.cache.set(cacheKey, result);

        return result;
    }

    /**
     * 1 try + up to retryDelaysMs.length retries, only for temporary errors
     * (timeout, network error, 429, 5xx). Other 4xx errors are thrown at once.
     */
    private async fetchWithRetry(url: string): Promise<Response> {
        for (let attempt = 0; ; attempt++) {
            try {
                return await this.fetchOnce(url);
            } catch (error) {
                if (
                    !isRetryable(error) ||
                    attempt >= this.retryDelaysMs.length
                ) {
                    throw error;
                }
                await this.sleep(this.retryDelaysMs[attempt]);
            }
        }
    }

    private async fetchOnce(url: string): Promise<Response> {
        // Every attempt keeps the Nominatim rule of 1 request per second.
        await this.waitForRateLimit();

        const response = await this.fetchFn(url, {
            headers: {
                'User-Agent': this.userAgent,
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!response.ok) {
            throw new GeocodingHttpError(response.status);
        }

        return response;
    }

    private nextRequestAt = 0;
    private requestQueue: Promise<void> = Promise.resolve();

    private async waitForRateLimit(): Promise<void> {
        const previousRequest = this.requestQueue;

        let release!: () => void;
        this.requestQueue = new Promise<void>((resolve) => {
            release = resolve;
        });

        await previousRequest;

        const delay = Math.max(0, this.nextRequestAt - Date.now());

        if (delay > 0) {
            await this.sleep(delay);
        }

        this.nextRequestAt = Date.now() + this.minIntervalMs;
        release();
    }

}
