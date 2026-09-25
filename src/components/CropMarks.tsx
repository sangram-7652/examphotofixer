/** Four corner brackets inside a `relative` parent: the site's crop-mark motif. Decorative. */
export function CropMarks({ inset = "0.5rem" }: { inset?: string }) {
  const corners = [
    { top: inset, left: inset, className: "border-t-2 border-l-2" },
    { top: inset, right: inset, className: "border-t-2 border-r-2" },
    { bottom: inset, left: inset, className: "border-b-2 border-l-2" },
    { bottom: inset, right: inset, className: "border-b-2 border-r-2" },
  ];
  return (
    <>
      {corners.map(({ className, ...position }, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`crop-mark ${className}`}
          style={position}
        />
      ))}
    </>
  );
}
