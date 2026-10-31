
import { Module } from '@nestjs/common';
import {
    GeocodingService,
    GEOCODING_PROVIDER,
} from './geocoding.service';
import { NominatimGeocodingAdapter } from './adapters/nominatim-geocoding.adapter';

@Module({
    providers: [
        GeocodingService,
        {
            provide: GEOCODING_PROVIDER,
            useFactory: () => {
                const userAgent =
                    process.env.GEOCODING_USER_AGENT?.trim();

                if (!userAgent) {
                    throw new Error(
                        'GEOCODING_USER_AGENT must be configured',
                    );
                }

                return new NominatimGeocodingAdapter(
                    userAgent,
                    process.env.GEOCODING_BASE_URL ||
                    'https://nominatim.openstreetmap.org',
                    Number(process.env.GEOCODING_TIMEOUT_MS || 3000),
                );
            },
        },
    ],
    exports: [GeocodingService],
})
export class GeocodingModule { }
