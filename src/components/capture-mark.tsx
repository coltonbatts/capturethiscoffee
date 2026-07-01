import Image from "next/image";
import { captureThisSmileySrc } from "@/lib/brand-assets";

type CaptureMarkProps = {
  className?: string;
  /** Kept for older call sites; the smiley artwork is already self-contained. */
  invert?: boolean;
  priority?: boolean;
  title?: string;
};

export function CaptureMark({
  className = "size-10",
  priority = false,
  title = "Capture This",
}: CaptureMarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      role="img"
      aria-label={title}
    >
      <Image
        src={captureThisSmileySrc}
        alt=""
        width={750}
        height={750}
        className="h-full w-full object-contain"
        loading={priority ? "eager" : "lazy"}
        priority={priority}
      />
    </span>
  );
}
