
export interface GeocodingResult {
    latitude: number;
    longitude: number;
    displayName: string;
}

export interface GeocodingProvider {
    geocode(placeName: string): Promise<GeocodingResult | null>;
}
