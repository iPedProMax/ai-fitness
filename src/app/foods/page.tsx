import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FoodSmartSearch } from "@/components/food-smart-search";

export const dynamic = "force-dynamic";

export default async function FoodLibraryPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/login?message=" + encodeURIComponent("Sign in to browse foods."));
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-7 sm:py-10">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-emerald-700">Khalories AI / Food discovery</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#173e29] sm:text-4xl">Find food. Log faster.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c7163]">Find packaged food nutrition without spending AI credits. Pick a product, check its serving, and log what you actually ate.</p>
      </div>
      <Link href="/?mode=barcode" className="inline-flex min-h-11 items-center rounded-xl border border-[#bbd6ba] bg-white px-4 py-2.5 text-sm font-bold text-[#176344] shadow-sm transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Scan barcode</Link>
    </header>

    <FoodSmartSearch mode="browse" initialQuery={query} />

    <footer className="border-t border-[#dce7d9] pt-4 text-xs leading-5 text-[#607464]">
      <p>Product information comes from reviewed Khalories Philippine labels when available and separately from the Open Food Facts community database. Community data can be incomplete. Compare with your package label; unknown nutrients stay unknown. No AI-generated values are automatically published.</p>
    </footer>
  </main>;
}
