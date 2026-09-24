"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Size } from "@/lib/image/geometry";
import {
  INITIAL_CROP,
  MAX_UI_ZOOM,
  panCrop,
  viewportLayout,
  zoomCrop,
  type ViewportCrop,
} from "@/lib/tools/cropper";

interface CropperProps {
  imageUrl: string;
  /** Natural (oriented) image size. */
  imageSize: Size;
  /** Output size; only its aspect ratio is used here. */
  target: Size;
  value: ViewportCrop;
  onChange: (crop: ViewportCrop) => void;
  label: string;
}

const KEY_PAN_PX = 12;
const KEY_ZOOM_STEP = 0.1;

type Gesture =
  | { kind: "pan"; startX: number; startY: number; start: ViewportCrop }
  | { kind: "pinch"; startDistance: number; start: ViewportCrop };

/**
 * Collects a viewport crop (centre + zoom) for the engine. Geometry comes from
 * the engine's `resolveCropRect`; this component only renders and handles input.
 */
export function Cropper({ imageUrl, imageSize, target, value, onChange, label }: CropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const positionId = useId();
  const [frameWidth, setFrameWidth] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const layout = frameWidth > 0 ? viewportLayout(imageSize, target, value, frameWidth) : null;

  const beginGesture = () => {
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.current = {
        kind: "pinch",
        startDistance: Math.hypot(a.x - b.x, a.y - b.y),
        start: value,
      };
    } else if (points.length === 1) {
      gesture.current = { kind: "pan", startX: points[0].x, startY: points[0].y, start: value };
    } else {
      gesture.current = null;
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginGesture();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || frameWidth === 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (current?.kind === "pan") {
      onChange(
        panCrop(
          imageSize,
          target,
          current.start,
          event.clientX - current.startX,
          event.clientY - current.startY,
          frameWidth,
        ),
      );
    } else if (current?.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (current.startDistance > 0) {
        onChange(
          zoomCrop(
            imageSize,
            target,
            current.start,
            (current.start.zoom * distance) / current.startDistance,
          ),
        );
      }
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    beginGesture();
  };

  const setZoom = (zoom: number) => onChange(zoomCrop(imageSize, target, value, zoom));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN_PX, 0],
      ArrowRight: [-KEY_PAN_PX, 0],
      ArrowUp: [0, KEY_PAN_PX],
      ArrowDown: [0, -KEY_PAN_PX],
    };
    if (moves[event.key] && frameWidth > 0) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      onChange(panCrop(imageSize, target, value, dx, dy, frameWidth));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(value.zoom + KEY_ZOOM_STEP);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setZoom(value.zoom - KEY_ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      onChange(INITIAL_CROP);
    }
  };

  const landscape = target.width > target.height;
  const position = `Position ${Math.round(value.center.x * 100)}% across, ${Math.round(
    value.center.y * 100,
  )}% down, zoom ${value.zoom.toFixed(1)}×`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={frameRef}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Drag to move. Arrow keys move, plus and minus zoom, 0 resets.`}
        aria-describedby={positionId}
        data-testid="crop-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        style={{ aspectRatio: `${target.width} / ${target.height}` }}
        className={`relative w-full cursor-grab touch-none overflow-hidden rounded-lg bg-surface outline-none select-none ring-2 ring-brand focus-visible:ring-4 active:cursor-grabbing ${
          landscape ? "max-w-sm" : "max-w-64"
        }`}
      >
        {layout ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL; next/image can't optimise it
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            decoding="async"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate(${layout.offsetX}px, ${layout.offsetY}px)`,
            }}
            className="pointer-events-none absolute top-0 left-0 max-w-none"
          />
        ) : null}
      </div>
      <p id={positionId} className="sr-only" aria-live="polite" data-testid="crop-position">
        {position}
      </p>

      <div className="flex w-full max-w-sm items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom(value.zoom - 0.25)}
          disabled={value.zoom <= 1}
          aria-label="Zoom out"
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-border text-xl font-semibold focus-visible:outline-3 focus-visible:outline-brand disabled:opacity-40"
        >
          −
        </button>
        <label className="flex flex-1 flex-col">
          <span className="sr-only">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_UI_ZOOM}
            step={0.05}
            value={value.zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-11 w-full accent-brand"
          />
        </label>
        <button
          type="button"
          onClick={() => setZoom(value.zoom + 0.25)}
          disabled={value.zoom >= MAX_UI_ZOOM}
          aria-label="Zoom in"
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-border text-xl font-semibold focus-visible:outline-3 focus-visible:outline-brand disabled:opacity-40"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onChange(INITIAL_CROP)}
          className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-sm font-medium focus-visible:outline-3 focus-visible:outline-brand"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
