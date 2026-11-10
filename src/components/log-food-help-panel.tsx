import type { ReactNode } from "react";

type Mode = "photo" | "barcode" | "manual" | "saved";

type HelpRow = { title: string; detail: string };

const help: Record<Mode, { eyebrow: string; title: string; description: string; steps: HelpRow[]; tip: string }> = {
  barcode: {
    eyebrow: "Barcode guide",
    title: "Know what you're logging",
    description: "A barcode identifies a product. Its community nutrition information still needs a quick label check.",
    steps: [
      { title: "Scan or type a barcode", detail: "Use the camera, a barcode photo, or the number on the package." },
      { title: "Confirm the exact variant", detail: "Check the flavor and package size before choosing the serving." },
      { title: "Review, verify, then log", detail: "Adjust amounts, or open the optional AI label assistant if unsure." },
    ],
    tip: "Database lookup is free. AI verification is optional and only spends an analysis credit when submitted.",
  },
  manual: {
    eyebrow: "Manual guide",
    title: "Search first. Type less.",
    description: "Pick a known fruit or food to autofill the available nutrition; add your own quantities and corrections.",
    steps: [
      { title: "Pick a manual tool", detail: "Find Food, Calculator, Enter Details and AI Estimate serve different needs." },
      { title: "Enter the food-only serving", detail: "In Calculator, select a measurement unit and exclude the plate, bowl or packaging." },
      { title: "Review your meal", detail: "Use AI only if the food is missing or you need an estimate." },
    ],
    tip: "Generic fruit references are per 100 g of edible flesh and can vary by variety and ripeness.",
  },
  photo: {
    eyebrow: "Photo guide",
    title: "Let the photo tell the story",
    description: "Include the food and, when helpful, packaging, the nutrition label, or a scale reading.",
    steps: [
      { title: "Choose how to scan", detail: "Use Khalories AI for an in-app scan, or AI Web Import to paste nutrition from another AI website without Khalories scan credits." },
      { title: "Scan or import", detail: "In-app scans accept provider-limited photos. Web Import accepts normal text, tables or JSON and optionally a meal-history thumbnail." },
      { title: "Review before saving", detail: "Confirm the serving, scale tare status and nutrition. A photo is stored only if you opt in at Save." },
    ],
    tip: "AI nutrition is estimated, not laboratory-measured. In-app scans may consume credits on submission; Web Import itself does not.",
  },
  saved: {
    eyebrow: "Your kitchen",
    title: "Favorites, on repeat",
    description: "Reuse a saved food or customize a Filipino recipe instead of starting every meal from scratch.",
    steps: [
      { title: "Browse recipes or favorites", detail: "Find a familiar meal using search and category filters." },
      { title: "Adjust the serving", detail: "Customize ingredients and quantities to match what you ate." },
      { title: "Save the meal", detail: "Review the estimated nutrition before adding to your diary." },
    ],
    tip: "Recipe nutrition depends on ingredients and cooking method; adjust the preset to match your version.",
  },
};

function Numbered({ children, index }: { children: ReactNode; index: number }) {
  return <li className="k-lf-help-step"><span className="k-lf-help-number" aria-hidden="true">{index + 1}</span><div>{children}</div></li>;
}

export function LogFoodHelpPanel({ mode }: { mode: Mode }) {
  const current = help[mode];
  return <div className="k-lf-help-stack">
    <section className="k-lf-help-card" aria-label={`${current.eyebrow} steps`}>
      <p className="k-lf-help-eyebrow">✦ {current.eyebrow}</p>
      <h2>{current.title}</h2>
      <p className="k-lf-help-description">{current.description}</p>
      <ol className="k-lf-help-list">
        {current.steps.map((step, index) => <Numbered key={step.title} index={index}><strong>{step.title}</strong><p>{step.detail}</p></Numbered>)}
      </ol>
    </section>
    <section className="k-lf-help-card k-lf-help-tip" aria-label="Helpful reminder">
      <div className="k-lf-help-tip-title"><span aria-hidden="true">✳</span> Good to know</div>
      <p>{current.tip}</p>
    </section>
    <p className="k-lf-help-footer">Khalories AI · Big cravings. <strong>Smart tracking.</strong></p>
  </div>;
}
