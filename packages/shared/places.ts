// The place finder (GET /places): districts and provinces from our own table first, then OpenStreetMap.

export type Place = {
  name: string;
  /** the province of a district, or the rest of an OSM address; null when there is nothing more */
  detail: string | null;
  lng: number;
  lat: number;
  /** [west, south, east, north] */
  bbox: [number, number, number, number] | null;
  source: 'local' | 'osm';
};

/** online: false when OpenStreetMap was down, slow or answered nonsense (local results still come). */
export type PlacesAnswer = { places: Place[]; online: boolean };

export const PLACE_QUERY_MIN = 2;
export const PLACE_QUERY_MAX = 80;
