
import type {
    GeocodingProvider,
    GeocodingResult,
} from '../interfaces/geocoding-provider.interface';

interface NominatimResponse {
    lat: string;
    lon: string;
    display_name: string;
}

export class NominatimGeocodingAdapter
    implements GeocodingProvider {
    private readonly cache = new Map<
        string,
        GeocodingResult | null
    >();

    constructor(
        private readonly userAgent: string,
        private readonly baseUrl =
            'https://nominatim.openstreetmap.org',
        private readonly timeoutMs = 3000,
    ) { }

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
        await this.waitForRateLimit();
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': this.userAgent,
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!response.ok) {
            throw new Error(
                `Geocoding API failed: ${response.status}`,
            );
        }

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
            await new Promise<void>((resolve) => {
                setTimeout(resolve, delay);
            });
        }

        this.nextRequestAt = Date.now() + 1100;
        release();
    }

}
