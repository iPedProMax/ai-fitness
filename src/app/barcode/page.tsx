import { redirect } from "next/navigation";

// The legacy URL remains valid but every logging method now has one home.
export default function BarcodePage() {
  redirect("/?mode=barcode");
}
