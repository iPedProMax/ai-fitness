import {
    describe,
    expect,
    it,
} from "vitest";

import {
    foodAnalysisPrompt,
} from "./food-analysis-prompt";

describe(
    "prepared drink clarification",
    () => {
        it("asks about hidden additions for prepared drinks when the label only covers the base drink", () => {
            expect(
                foodAnalysisPrompt
            ).toContain(
                "PREPARED DRINK CLARIFICATION"
            );

            expect(
                foodAnalysisPrompt
            ).toContain(
                "Did you add anything else to this drink?"
            );

            expect(
                foodAnalysisPrompt
            ).toContain(
                '["Nothing", "Sugar", "Milk", "Other"]'
            );

            expect(
                foodAnalysisPrompt
            ).toContain(
                "open or prepared drink"
            );

            expect(
                foodAnalysisPrompt.toLowerCase()
            ).toContain(
                "do not assume there were no hidden additions"
            );
        });

        it("does not require the extra question for sealed packaged drinks consumed as-is", () => {
            expect(
                foodAnalysisPrompt
            ).toContain(
                "sealed packaged drink"
            );

            expect(
                foodAnalysisPrompt
            ).toContain(
                "do not ask this clarification"
            );
        });
    }
);