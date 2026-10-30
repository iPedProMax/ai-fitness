import Link from "next/link";
import { BarcodeLookup } from "@/components/barcode-lookup";
export default function BarcodePage(){return <main className="bg-slate-50 px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto max-w-3xl"><Link href="/" className="text-sm font-semibold text-emerald-700 hover:underline">← Log Food</Link><h1 className="mt-5 text-3xl font-extrabold">Barcode & food search</h1><p className="my-4 text-sm text-slate-600">Find packaged-food nutrition, choose a serving amount and save it to your diary. Free, no AI call.</p><BarcodeLookup/></div></main>}
