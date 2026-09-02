import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Section 1 — Logo asset mapping.
 *
 * Official artwork supplied by the Product Owner for the new product
 * name "VNG-ZPSxUIT-GameDev CoTrain" (fox icon + "GameDev CoTrain"
 * wordmark, transparent background). Replaces the temporary text-only
 * logo that was in place while waiting for real art. One file is used
 * for both light and dark themes (transparent background reads fine on
 * either), same approach as the original pre-rename asset — so
 * `variant` is kept only for type-compatibility with existing call
 * sites, it does not select a different file.
 */

const PRODUCT_NAME = "VNG-ZPSxUIT-GameDev CoTrain";

// Natural pixel aspect ratio of the source PNGs (width / height), used so
// <Image> can compute a correct intrinsic size while CSS scales by height.
const LOGO_FULL_ASPECT = 2108 / 678;
const LOGO_MARK_ASPECT = 416 / 688;

export function LogoFull({
  className,
  height = 40,
  variant = "auto",
}: {
  className?: string;
  height?: number;
  variant?: "auto" | "light" | "dark";
}) {
  void variant;
  return (
    <Image
      src="/brand/logo-full-light.png"
      alt={PRODUCT_NAME}
      height={height}
      width={Math.round(height * LOGO_FULL_ASPECT)}
      className={cn("select-none object-contain", className)}
      style={{ height, width: "auto" }}
      priority
    />
  );
}

export function LogoMark({ className, height = 28 }: { className?: string; height?: number }) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt={PRODUCT_NAME}
      height={height}
      width={Math.round(height * LOGO_MARK_ASPECT)}
      className={cn("select-none object-contain", className)}
      style={{ height, width: "auto" }}
    />
  );
}
