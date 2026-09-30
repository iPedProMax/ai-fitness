type ClarificationAnswerConfig = {
  options: string[];
  allowCustomAnswer?: boolean;
};

export function isValidClarificationAnswer(
  clarification: ClarificationAnswerConfig,
  answer: string
) {
  const trimmedAnswer = answer.trim();

  if (!trimmedAnswer) {
    return false;
  }

  if (
    clarification.allowCustomAnswer === true
  ) {
    return true;
  }

  return clarification.options.includes(
    trimmedAnswer
  );
}