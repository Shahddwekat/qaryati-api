
import { jest } from '@jest/globals';
import { NominatimGeocodingAdapter } from './nominatim-geocoding.adapter';

const USER_AGENT = 'Qaryati/1.0 (test@example.com)';
const NABLUS = [
    { lat: '32.2211', lon: '35.2544', display_name: 'Nablus, Palestine' },
];

const okResponse = (body: unknown) =>
    ({ ok: true, json: async () => body }) as Response;
const failResponse = (status: number) =>
    ({ ok: false, status }) as Response;

/** Adapter with a fake fetch and no real waiting (the sleep calls are recorded). */
const makeAdapter = (fetchFn: typeof fetch) => {
    const sleep = jest
        .fn<(ms: number) => Promise<void>>()
        .mockResolvedValue(undefined);
    const adapter = new NominatimGeocodingAdapter(
        USER_AGENT,
        'https://nominatim.openstreetmap.org',
        3000,
        { fetchFn, sleep, minIntervalMs: 0 },
    );
    return { adapter, sleep };
};

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

    it('should throw an error when the geocoding API keeps failing', async () => {
        const fetchFn = jest
            .fn<typeof fetch>()
            .mockResolvedValue(failResponse(503));
        const { adapter } = makeAdapter(fetchFn);

        await expect(
            adapter.geocode('Nablus, Palestine'),
        ).rejects.toThrow('Geocoding API failed: 503');

        // 1 try + 2 retries
        expect(fetchFn).toHaveBeenCalledTimes(3);
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
                { minIntervalMs: 0, sleep: async () => undefined },
            );

            await expect(
                adapter.geocode('Nablus, Palestine'),
            ).rejects.toThrow();

            // a timeout is a temporary error: 1 try + 2 retries
            expect(fetchMock).toHaveBeenCalledTimes(3);
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
  

    describe('retry of temporary errors', () => {
        it('succeeds on the 2nd try after a 503', async () => {
            const fetchFn = jest
                .fn<typeof fetch>()
                .mockResolvedValueOnce(failResponse(503))
                .mockResolvedValueOnce(okResponse(NABLUS));
            const { adapter, sleep } = makeAdapter(fetchFn);

            await expect(
                adapter.geocode('Nablus, Palestine'),
            ).resolves.toEqual({
                latitude: 32.2211,
                longitude: 35.2544,
                displayName: 'Nablus, Palestine',
            });

            expect(fetchFn).toHaveBeenCalledTimes(2);
            expect(sleep).toHaveBeenCalledTimes(1);
            expect(sleep).toHaveBeenCalledWith(500);
        });

        it('gives up after 3 tries and waits 500 ms, then 1 s', async () => {
            const fetchFn = jest
                .fn<typeof fetch>()
                .mockRejectedValue(new TypeError('fetch failed'));
            const { adapter, sleep } = makeAdapter(fetchFn);

            await expect(
                adapter.geocode('Nablus, Palestine'),
            ).rejects.toThrow('fetch failed');

            expect(fetchFn).toHaveBeenCalledTimes(3);
            expect(sleep).toHaveBeenCalledTimes(2);
            expect(sleep).toHaveBeenNthCalledWith(1, 500);
            expect(sleep).toHaveBeenNthCalledWith(2, 1000);
        });

        it('retries on 429', async () => {
            const fetchFn = jest
                .fn<typeof fetch>()
                .mockResolvedValueOnce(failResponse(429))
                .mockResolvedValueOnce(okResponse(NABLUS));
            const { adapter } = makeAdapter(fetchFn);

            await expect(
                adapter.geocode('Nablus, Palestine'),
            ).resolves.not.toBeNull();
            expect(fetchFn).toHaveBeenCalledTimes(2);
        });

        it('does not retry on 400', async () => {
            const fetchFn = jest
                .fn<typeof fetch>()
                .mockResolvedValue(failResponse(400));
            const { adapter, sleep } = makeAdapter(fetchFn);

            await expect(adapter.geocode('Nablus')).rejects.toThrow(
                'Geocoding API failed: 400',
            );

            expect(fetchFn).toHaveBeenCalledTimes(1);
            expect(sleep).not.toHaveBeenCalled();
        });

        it('does not retry when the place is not found', async () => {
            const fetchFn = jest
                .fn<typeof fetch>()
                .mockResolvedValue(okResponse([]));
            const { adapter, sleep } = makeAdapter(fetchFn);

            await expect(
                adapter.geocode('Unknown Village'),
            ).resolves.toBeNull();

            expect(fetchFn).toHaveBeenCalledTimes(1);
            expect(sleep).not.toHaveBeenCalled();
        });

        it('keeps the 1-request-per-second wait on every try', async () => {
            const fetchFn = jest
                .fn<typeof fetch>()
                .mockResolvedValueOnce(failResponse(503))
                .mockResolvedValueOnce(okResponse(NABLUS));
            const sleep = jest
                .fn<(ms: number) => Promise<void>>()
                .mockResolvedValue(undefined);
            const adapter = new NominatimGeocodingAdapter(
                USER_AGENT,
                'https://nominatim.openstreetmap.org',
                3000,
                { fetchFn, sleep, minIntervalMs: 60_000 },
            );

            await adapter.geocode('Nablus, Palestine');

            // retry wait (500 ms) + the rate-limit wait before the 2nd request
            const waits = sleep.mock.calls.map(([ms]) => ms);
            expect(waits[0]).toBe(500);
            expect(waits.some((ms) => ms > 1000)).toBe(true);
        });
    });

});
