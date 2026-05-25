import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  href?: string;
  variant?: "lockup" | "mark";
  showBeta?: boolean;
};

const lockupPath = "/brand/vultkey-lockup.png";
const markPath = "/brand/vultkey-icon.png";

export function LogoMark({ className }: { className?: string }) {
  return <Image src={markPath} alt="" className={cn("block size-8 object-contain", className)} width={260} height={260} aria-hidden="true" />;
}

export function BetaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-4 items-center rounded border border-primary/25 bg-primary/12 px-1.5 text-[9px] font-semibold leading-none tracking-[0.08em] text-primary", className)}>
      Beta
    </span>
  );
}

export function Logo({ className, href = "/dashboard", variant = "lockup", showBeta = true }: LogoProps) {
  const isMark = variant === "mark";

  return (
    <Link href={href} className={cn("relative inline-flex shrink-0 items-center rounded-md pr-7 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isMark && "pr-4", className)} aria-label="Vultkey beta">
      {isMark ? (
        <LogoMark />
      ) : (
        <Image src={lockupPath} alt="Vultkey" className="block h-9 w-auto object-contain" width={559} height={174} priority />
      )}
      {showBeta ? <BetaBadge className="absolute -right-2 top-4" /> : null}
    </Link>
  );
}
