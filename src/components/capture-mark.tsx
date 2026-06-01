import type { SVGProps } from "react";

type CaptureMarkProps = {
  className?: string;
  /** White tile with black angle (header / login on dark). */
  invert?: boolean;
  title?: string;
};

export function CaptureMark({
  className = "size-10",
  invert = false,
  title = "Capture This",
}: CaptureMarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${
        invert ? "bg-white text-black" : "bg-black text-white"
      } ${className}`}
      role="img"
      aria-label={title}
    >
      <CaptureAngle className="h-[78%] w-[78%]" />
    </span>
  );
}

/** Inline angle from brand artwork (right angle at bottom-left). */
export function CaptureAngle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1058 448"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M0 448 1058 446 2 0Z" />
    </svg>
  );
}
