import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={clsx("brand-logo", className)} aria-label="Cari Market, beranda">
      <span className="brand-logo__tile">
        <Image
          src="/logo-carimarket.png"
          alt=""
          width={839}
          height={184}
          priority
          className={clsx("brand-logo__image", compact && "brand-logo__image--compact")}
        />
      </span>
      {compact && <span className="sr-only">Cari Market</span>}
    </Link>
  );
}
