/** Kilometres per degree of latitude (and of longitude at the equator). */
export const KM_PER_DEGREE = 111.045;

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * The rectangle that contains every point within `radiusKm` of the centre
 * (ADR-0006). It lets MySQL use the (latitude, longitude) index to keep only a
 * few candidates before computing the exact distance with ST_Distance_Sphere.
 * A degree of longitude gets shorter away from the equator, hence the cosine.
 */
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number,
): BoundingBox {
  const dLat = radiusKm / KM_PER_DEGREE;
  const dLng =
    radiusKm / (KM_PER_DEGREE * Math.cos((latitude * Math.PI) / 180));
  return {
    minLat: latitude - dLat,
    maxLat: latitude + dLat,
    minLng: longitude - dLng,
    maxLng: longitude + dLng,
  };
}
