
import { jest } from '@jest/globals';
import { NominatimGeocodingAdapter } from './nominatim-geocoding.adapter';

describe('NominatimGeocodingAdapter', () => {

    it('should return null for an empty place name', async () => {
        const fetchMock = jest
            .spyOn(globalThis, 'fetch')
            .mockImplementation(() => {
                throw new Error('Fetch should not be called');
            });

        try {
            const adapter = new NominatimGeocodingAdapter(
                'Qaryati/1.0 (test@example.com)',
            );

            const result = await adapter.geocode('   ');

            expect(result).toBeNull();
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            fetchMock.mockRestore();
        }
    });

    it('should return coordinates for a valid place', async () => {
        const mockResponse = {
            ok: true,
            json: async () => [
                {
                    lat: '32.2211',
                    lon: '35.2544',
                    display_name: 'Nablus, Palestine',
                },
            ],
        };

        const fetchMock = jest
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(mockResponse as Response);

        try {
            const adapter = new NominatimGeocodingAdapter(
                'Qaryati/1.0 (test@example.com)',
            );

            const result = await adapter.geocode('Nablus, Palestine');

            expect(result).toEqual({
                latitude: 32.2211,
                longitude: 35.2544,
                displayName: 'Nablus, Palestine',
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            fetchMock.mockRestore();
        }
    });

    it('should return null when the location is not found', async () => {
        const mockResponse = {
            ok: true,
            json: async () => [],
        };

        const fetchMock = jest
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(mockResponse as Response);

        try {
            const adapter = new NominatimGeocodingAdapter(
                'Qaryati/1.0 (test@example.com)',
            );

            const result = await adapter.geocode('Unknown Village');

            expect(result).toBeNull();
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            fetchMock.mockRestore();
        }
    });

    it('should throw an error when the geocoding API fails', async () => {
        const mockResponse = {
            ok: false,
            status: 503,
        };

        const fetchMock = jest
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(mockResponse as Response);

        try {
            const adapter = new NominatimGeocodingAdapter(
                'Qaryati/1.0 (test@example.com)',
            );

            await expect(
                adapter.geocode('Nablus, Palestine'),
            ).rejects.toThrow('Geocoding API failed: 503');

            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            fetchMock.mockRestore();
        }
    });

    it('should reject invalid geocoding coordinates', async () => {
        const mockResponse = {
            ok: true,
            json: async () => [
                {
                    lat: '999',
                    lon: '35.2544',
                    display_name: 'Invalid Location',
                },
            ],
        };

        const fetchMock = jest
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(mockResponse as Response);

        try {
            const adapter = new NominatimGeocodingAdapter(
                'Qaryati/1.0 (test@example.com)',
            );

            await expect(
                adapter.geocode('Invalid Location'),
            ).rejects.toThrow('Invalid geocoding coordinates');

            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            fetchMock.mockRestore();
        }
    });

    it('should handle a geocoding request timeout', async () => {
        const fetchMock = jest
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async (_url, options) => {
                const signal = options?.signal;

                return new Promise<Response>((_resolve, reject) => {
                    if (!signal) {
                        reject(new Error('Abort signal is missing'));
                        return;
                    }

                    if (signal.aborted) {
                        reject(signal.reason);
                        return;
                    }

                    signal.addEventListener(
                        'abort',
                        () => reject(signal.reason),
                        { once: true },
                    );
                });
            });

        try {
            const adapter = new NominatimGeocodingAdapter(
                'Qaryati/1.0 (test@example.com)',
                'https://nominatim.openstreetmap.org',
                20,
            );

            await expect(
                adapter.geocode('Nablus, Palestine'),
            ).rejects.toThrow();

            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            fetchMock.mockRestore();
        }
    });

    
it('should cache geocoding results and avoid duplicate API calls', async () => {
    const mockResponse = {
      ok: true,
      json: async () => [
        {
          lat: '32.2211',
          lon: '35.2544',
          display_name: 'Nablus, Palestine',
        },
      ],
    };
  
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse as Response);
  
    try {
      const adapter = new NominatimGeocodingAdapter(
        'Qaryati/1.0 (test@example.com)',
      );
  
      const firstResult = await adapter.geocode('Nablus, Palestine');
      const secondResult = await adapter.geocode('  nablus, palestine  ');
  
      expect(firstResult).toEqual(secondResult);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
    }
  });
  

});
