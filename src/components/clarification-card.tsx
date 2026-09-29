"use client";

type Clarification = {
  id: string;
  foodIndex: number;
  question: string;
  options: string[];
};

type ClarificationCardProps = {
  clarification: Clarification;
  selectedAnswer: string | null;
  onSelect: (answer: string) => void;
  disabled?: boolean;
};

export function ClarificationCard({
  clarification,
  selectedAnswer,
  onSelect,
  disabled = false,
}: ClarificationCardProps) {
  const isTareQuestion =
    clarification.id.startsWith(
      "tare_status_"
    );

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Clarification needed
      </p>

      <p className="mt-2 font-semibold text-slate-900">
        {clarification.question}
      </p>

      <p className="mt-1 text-sm text-slate-600">
        {isTareQuestion
          ? "We need this to know whether the scale reading represents food-only weight."
          : "The AI is not confident enough to guess this ingredient."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {clarification.options.map(
          (option) => {
            const isSelected =
              selectedAnswer === option;

            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onSelect(option)
                }
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50"
                } disabled:cursor-wait disabled:opacity-60`}
              >
                {option}
              </button>
            );
          }
        )}
      </div>

      {disabled &&
        selectedAnswer && (
          <p className="mt-3 text-sm font-medium text-emerald-700">
            ✨ Updating nutrition
            using {selectedAnswer}...
          </p>
        )}

      {!disabled &&
        selectedAnswer && (
          <p className="mt-3 text-sm font-medium text-emerald-700">
            ✓ Selected:{" "}
            {selectedAnswer}
          </p>
        )}
    </div>
  );
}