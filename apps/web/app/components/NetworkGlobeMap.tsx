"use client";

import {
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PilotProfile, StaffingRequest } from "@crewlink/domain";
import {
  clamp,
  drawProjectedLine,
  drawProjectedRing,
  extractLandRings,
  INITIAL_GLOBE_VIEW,
  LAND_GEOJSON_URL,
  projectGlobePoint,
  type GeoPoint,
  type GlobeView,
  type LandFeatureCollection,
} from "./globe-projection";
import "./NetworkGlobeMap.css";

type NetworkGlobeMapProps = {
  pilots: PilotProfile[];
  requests: StaffingRequest[];
};

export default function NetworkGlobeMap({ pilots, requests }: NetworkGlobeMapProps) {
  const globeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const globeDragRef = useRef<{
    x: number;
    y: number;
    lat: number;
    long: number;
  } | null>(null);
  const [landRings, setLandRings] = useState<GeoPoint[][]>([]);
  const [landStatus, setLandStatus] = useState("");
  const [globeView, setGlobeView] = useState<GlobeView>(INITIAL_GLOBE_VIEW);
  const [instructionsVisible, setInstructionsVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLandStatus("");
        const response = await fetch(LAND_GEOJSON_URL);
        if (!response.ok) {
          throw new Error(`Failed to load globe outlines (${response.status})`);
        }
        const collection = (await response.json()) as LandFeatureCollection;
        if (!cancelled) setLandRings(extractLandRings(collection));
      } catch (error) {
        if (!cancelled) {
          setLandRings([]);
          setLandStatus(
            error instanceof Error
              ? error.message
              : "Failed to load geographic outlines.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = globeCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.36 * globeView.zoom;

      const ocean = ctx.createRadialGradient(
        centerX - radius * 0.28,
        centerY - radius * 0.34,
        radius * 0.1,
        centerX,
        centerY,
        radius,
      );
      ocean.addColorStop(0, "rgba(104, 211, 255, 0.38)");
      ocean.addColorStop(0.55, "rgba(10, 73, 112, 0.28)");
      ocean.addColorStop(1, "rgba(4, 25, 47, 0.76)");

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = ocean;
      ctx.fill();
      ctx.clip();

      for (const ring of landRings) {
        ctx.beginPath();
        const visiblePoints = drawProjectedRing(
          ctx,
          ring,
          globeView,
          centerX,
          centerY,
          radius,
        );
        if (visiblePoints < 2) continue;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(230, 242, 232, 0.74)";
        ctx.stroke();
      }

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      for (let lat = -75; lat <= 75; lat += 15) {
        ctx.beginPath();
        drawProjectedLine(
          ctx,
          Array.from({ length: 181 }, (_, index) => ({
            lat,
            long: -180 + index * 2,
          })),
          globeView,
          centerX,
          centerY,
          radius,
        );
        ctx.stroke();
      }
      for (let long = -180; long <= 180; long += 15) {
        ctx.beginPath();
        drawProjectedLine(
          ctx,
          Array.from({ length: 81 }, (_, index) => ({
            lat: -80 + index * 2,
            long,
          })),
          globeView,
          centerX,
          centerY,
          radius,
        );
        ctx.stroke();
      }

      const drawMarker = (
        lat: number,
        long: number,
        color: string,
        label: string,
      ) => {
        const projected = projectGlobePoint(
          lat,
          long,
          globeView,
          centerX,
          centerY,
          radius,
        );
        if (!projected.visible) return;

        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = "700 11px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.fillText(label, projected.x + 9, projected.y - 7);
      };

      for (const request of requests) {
        drawMarker(
          request.location.latitude,
          request.location.longitude,
          "#f5a524",
          request.departureAirport,
        );
      }

      for (const pilot of pilots) {
        drawMarker(
          pilot.currentLocation.latitude,
          pilot.currentLocation.longitude,
          "#24c47e",
          pilot.homeBase,
        );
      }

      ctx.restore();

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.stroke();
    };

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [globeView, landRings, pilots, requests]);

  const handleGlobePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    globeDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      lat: globeView.lat,
      long: globeView.long,
    };
  };

  const handleGlobePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = globeDragRef.current;
    if (!drag) return;
    const sensitivity = 0.18 / Math.max(1, globeView.zoom / 2);
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    setGlobeView((view) => ({
      ...view,
      long: drag.long - deltaX * sensitivity,
      lat: clamp(drag.lat + deltaY * sensitivity, -82, 82),
    }));
  };

  const handleGlobePointerEnd = () => {
    globeDragRef.current = null;
  };

  const handleGlobeWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
    setGlobeView((view) => ({
      ...view,
      zoom: clamp(view.zoom * zoomDelta, 1, 6),
    }));
  };

  return (
    <div className="network-globe-map">
      <div className="network-globe-card">
        <div className="globe-map-stage">
          <canvas
            ref={globeCanvasRef}
            className="globe-map-canvas"
            aria-label="Interactive globe showing pilot and request locations"
            onPointerDown={handleGlobePointerDown}
            onPointerMove={handleGlobePointerMove}
            onPointerUp={handleGlobePointerEnd}
            onPointerCancel={handleGlobePointerEnd}
            onLostPointerCapture={handleGlobePointerEnd}
            onWheel={handleGlobeWheel}
          />
          {instructionsVisible && (
            <>
              <div className="globe-map-controls">
                <span>Drag to rotate · Scroll to zoom</span>
                <button type="button" onClick={() => setGlobeView(INITIAL_GLOBE_VIEW)}>
                  Reset US view
                </button>
                <button
                  type="button"
                  className="globe-map-dismiss"
                  aria-label="Hide map instructions"
                  onClick={() => setInstructionsVisible(false)}
                >
                  ×
                </button>
              </div>
              <div className="map-status-badge">
                {landStatus ||
                  `${pilots.length} pilots · ${requests.length} open requests plotted`}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="network-map-legend">
        <section className="network-map-legend-panel">
          <h3>
            <span className="legend-dot pilot" aria-hidden="true" />
            Pilots on network
          </h3>
          <div className="network-map-list">
            {pilots.length === 0 ? (
              <p className="muted">No pilot profiles on the network yet.</p>
            ) : (
              pilots.map((pilot) => (
              <div className="network-map-list-item" key={pilot.id}>
                <b>{pilot.name}</b>
                <span>
                  {pilot.role} · {pilot.homeBase} · {pilot.currentLocation.label}
                </span>
                <span>
                  {pilot.currentLocation.latitude.toFixed(2)}°,{" "}
                  {pilot.currentLocation.longitude.toFixed(2)}°
                </span>
              </div>
              ))
            )}
          </div>
        </section>

        <section className="network-map-legend-panel">
          <h3>
            <span className="legend-dot request" aria-hidden="true" />
            Open staffing requests
          </h3>
          <div className="network-map-list">
            {requests.length === 0 ? (
              <p className="muted">No open staffing requests yet.</p>
            ) : (
              requests.map((request) => (
              <div className="network-map-list-item" key={request.id}>
                <b>{request.departureAirport}</b>
                <span>
                  {request.aircraftType} · {request.title}
                </span>
                <span>
                  {request.location.latitude.toFixed(2)}°,{" "}
                  {request.location.longitude.toFixed(2)}° · {request.urgency}
                </span>
              </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
