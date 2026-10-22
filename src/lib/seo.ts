/**
 * Penyusun structured data.
 *
 * PRD meminta schema Organization, Article, FAQPage, dan Product/Offer, tetapi
 * sampai sekarang hanya detail artikel yang punya. Fungsi-fungsi di sini
 * dipakai halaman publik supaya bentuknya seragam dan alamat kanoniknya satu
 * sumber.
 */

export const ORGANIZATION_ID = "#organization";

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(path: string) {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationSchema() {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/${ORGANIZATION_ID}`,
    name: "Cari Market",
    url: base,
    logo: absoluteUrl("/logo-carimarket.png"),
    description: "Platform pencarian lead bisnis dari percakapan publik di Threads, dengan mode tinjau dulu sebagai bawaan.",
    areaServed: { "@type": "Country", name: "Indonesia" },
    knowsLanguage: ["id-ID"],
    contactPoint: [{
      "@type": "ContactPoint",
      contactType: "customer support",
      url: absoluteUrl("/kontak"),
      availableLanguage: ["Indonesian"],
    }],
  };
}

export function faqPageSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * Satu produk SaaS dengan beberapa penawaran, bukan beberapa produk terpisah:
 * paket Cari Market adalah tingkatan dari layanan yang sama.
 */
export function pricingSchema(plans: Array<{ code: string; name: string; monthlyPrice: number; tagline: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Cari Market",
    description: "Pencarian lead dari percakapan publik Threads dengan draft balasan dan mode tinjau dulu.",
    brand: { "@type": "Brand", name: "Cari Market" },
    url: absoluteUrl("/harga"),
    offers: plans.map(plan => ({
      "@type": "Offer",
      name: `Paket ${plan.name}`,
      description: plan.tagline,
      price: plan.monthlyPrice,
      priceCurrency: "IDR",
      url: absoluteUrl("/harga"),
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: plan.monthlyPrice,
        priceCurrency: "IDR",
        unitText: "bulan",
        billingDuration: 1,
        billingIncrement: 1,
      },
    })),
  };
}
