import { formatBytes } from "@/lib/validation/validate";

interface PreviewImage {
  url: string;
  width: number;
  height: number;
  byteLength: number;
}

/** Original vs final. Stacked on mobile, side by side from `sm`. */
export function ResultPreview({
  original,
  final,
}: {
  original: PreviewImage;
  final: PreviewImage;
}) {
  // Both previews fill the same box (letterboxed, never distorted), so the small
  // final image is shown enlarged enough to inspect.
  const figures = [
    { key: "original", title: "Original", image: original },
    { key: "final", title: "Final", image: final },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6">
      {figures.map(({ key, title, image }) => (
        <figure
          key={key}
          className="flex flex-col items-center rounded-lg bg-surface p-3"
          data-testid={`preview-${key}`}
        >
          <div className="h-40 w-full sm:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={image.url} alt={`${title} image`} className="h-full w-full object-contain" />
          </div>
          <figcaption className="mt-2 text-center text-xs sm:text-sm">
            <span className="block font-semibold">{title}</span>
            <span className="block tabular-nums text-muted">
              {image.width} × {image.height} px · {formatBytes(image.byteLength)}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
