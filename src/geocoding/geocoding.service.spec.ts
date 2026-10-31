import { Test } from '@nestjs/testing';
import { GeocodingModule } from './geocoding.module';
import { jest } from '@jest/globals';
import { GeocodingService } from './geocoding.service';
import type {
  GeocodingProvider,
  GeocodingResult,
} from './interfaces/geocoding-provider.interface';

describe('GeocodingService', () => {
  it('should delegate geocoding to the provider', async () => {
    const expectedResult: GeocodingResult = {
      latitude: 32.2211,
      longitude: 35.2544,
      displayName: 'Nablus, Palestine',
    };

    const geocodeMock = jest.fn<
      (placeName: string) => Promise<GeocodingResult | null>
    >().mockResolvedValue(expectedResult);

    const mockProvider: GeocodingProvider = {
      geocode: geocodeMock,
    };

    const service = new GeocodingService(mockProvider);

    const result = await service.geocode('Nablus, Palestine');

    expect(geocodeMock).toHaveBeenCalledWith(
      'Nablus, Palestine',
    );
    expect(geocodeMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expectedResult);
  });


  it('should resolve GeocodingService through NestJS DI', async () => {
    const previousUserAgent = process.env.GEOCODING_USER_AGENT;

    process.env.GEOCODING_USER_AGENT =
      'Qaryati/1.0 (automated unit test)';

    try {
      const testingModule = await Test.createTestingModule({
        imports: [GeocodingModule],
      }).compile();

      try {
        const service = testingModule.get(GeocodingService);

        expect(service).toBeDefined();
        expect(service.geocode).toBeInstanceOf(Function);
      } finally {
        await testingModule.close();
      }
    } finally {
      if (previousUserAgent === undefined) {
        delete process.env.GEOCODING_USER_AGENT;
      } else {
        process.env.GEOCODING_USER_AGENT = previousUserAgent;
      }
    }
  });


});
