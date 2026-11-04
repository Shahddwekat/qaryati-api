import { KM_PER_DEGREE, boundingBox } from './bounding-box';

describe('boundingBox', () => {
  it('is 1 degree of latitude wide per 111 km', () => {
    const box = boundingBox(0, 0, KM_PER_DEGREE);
    expect(box.minLat).toBeCloseTo(-1);
    expect(box.maxLat).toBeCloseTo(1);
    // At the equator a degree of longitude is as long as a degree of latitude.
    expect(box.maxLng).toBeCloseTo(1);
  });

  it('is wider in longitude than in latitude away from the equator', () => {
    const box = boundingBox(32, 35, 10);
    const latSpan = box.maxLat - box.minLat;
    const lngSpan = box.maxLng - box.minLng;
    expect(lngSpan).toBeGreaterThan(latSpan);
    expect(lngSpan / latSpan).toBeCloseTo(1 / Math.cos((32 * Math.PI) / 180));
  });

  it('is centred on the point', () => {
    const box = boundingBox(32.2764, 35.1958, 5);
    expect((box.minLat + box.maxLat) / 2).toBeCloseTo(32.2764);
    expect((box.minLng + box.maxLng) / 2).toBeCloseTo(35.1958);
  });
});
