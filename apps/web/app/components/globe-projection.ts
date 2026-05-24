export type GlobeView = {
  lat: number;
  long: number;
  zoom: number;
};

export type GeoPoint = {
  lat: number;
  long: number;
};

export type GeoJsonPosition = [number, number];
export type GeoJsonPolygon = GeoJsonPosition[][];
export type GeoJsonMultiPolygon = GeoJsonPolygon[];

export type LandFeature = {
  geometry?: {
    type?: string;
    coordinates?: GeoJsonPolygon | GeoJsonMultiPolygon;
  };
};

export type LandFeatureCollection = {
  features?: LandFeature[];
};

export const INITIAL_GLOBE_VIEW: GlobeView = {
  lat: 39,
  long: -98,
  zoom: 2.6,
};

export const LAND_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson";

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function projectGlobePoint(
  lat: number,
  long: number,
  view: GlobeView,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const latRad = degreesToRadians(lat);
  const longRad = degreesToRadians(long);
  const viewLatRad = degreesToRadians(view.lat);
  const viewLongRad = degreesToRadians(view.long);
  const deltaLong = longRad - viewLongRad;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinViewLat = Math.sin(viewLatRad);
  const cosViewLat = Math.cos(viewLatRad);
  const cosDeltaLong = Math.cos(deltaLong);

  const visibility = sinViewLat * sinLat + cosViewLat * cosLat * cosDeltaLong;
  const x = centerX + radius * cosLat * Math.sin(deltaLong);
  const y =
    centerY -
    radius * (cosViewLat * sinLat - sinViewLat * cosLat * cosDeltaLong);

  return {
    x,
    y,
    visible: visibility > 0,
    depth: visibility,
  };
}

export function drawProjectedLine(
  ctx: CanvasRenderingContext2D,
  points: Array<{ lat: number; long: number }>,
  view: GlobeView,
  centerX: number,
  centerY: number,
  radius: number,
) {
  let drawing = false;
  for (const point of points) {
    const projected = projectGlobePoint(
      point.lat,
      point.long,
      view,
      centerX,
      centerY,
      radius,
    );
    if (!projected.visible) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      ctx.moveTo(projected.x, projected.y);
      drawing = true;
    } else {
      ctx.lineTo(projected.x, projected.y);
    }
  }
}

export function drawProjectedRing(
  ctx: CanvasRenderingContext2D,
  points: GeoPoint[],
  view: GlobeView,
  centerX: number,
  centerY: number,
  radius: number,
): number {
  let drawing = false;
  let visiblePoints = 0;

  for (const point of points) {
    const projected = projectGlobePoint(
      point.lat,
      point.long,
      view,
      centerX,
      centerY,
      radius,
    );
    if (!projected.visible) {
      drawing = false;
      continue;
    }
    visiblePoints += 1;
    if (!drawing) {
      ctx.moveTo(projected.x, projected.y);
      drawing = true;
    } else {
      ctx.lineTo(projected.x, projected.y);
    }
  }

  return visiblePoints;
}

export function extractLandRings(collection: LandFeatureCollection): GeoPoint[][] {
  const rings: GeoPoint[][] = [];

  for (const feature of collection.features ?? []) {
    const geometry = feature.geometry;
    if (!geometry?.coordinates) continue;

    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates as GeoJsonPolygon]
        : geometry.type === "MultiPolygon"
          ? (geometry.coordinates as GeoJsonMultiPolygon)
          : [];

    for (const polygon of polygons) {
      for (const ring of polygon) {
        const points = ring
          .map(([long, lat]) => ({ lat, long }))
          .filter(
            (point) => Number.isFinite(point.lat) && Number.isFinite(point.long),
          );
        if (points.length >= 3) rings.push(points);
      }
    }
  }

  return rings;
}
