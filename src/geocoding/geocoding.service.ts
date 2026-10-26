
import { Inject, Injectable } from '@nestjs/common';

import type {
    GeocodingProvider,
    GeocodingResult,
} from './interfaces/geocoding-provider.interface';

export const GEOCODING_PROVIDER = 'GEOCODING_PROVIDER';

@Injectable()
export class GeocodingService {
    constructor(
        @Inject(GEOCODING_PROVIDER)
        private readonly provider: GeocodingProvider,
    ) { }

    async geocode(
        placeName: string,
    ): Promise<GeocodingResult | null> {
        return this.provider.geocode(placeName);
    }
}
