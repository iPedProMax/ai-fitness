/**
 * Height-entry conversion for the TDEE calculator. It keeps centimetres as the
 * internal measurement, but lets the user enter the height they actually know.
 * These helpers do not call any AI service.
 */
export function feetInchesToCentimeters(feet: number, inches: number): number {
  if (
    !Number.isInteger(feet) || feet < 0 || feet > 8 ||
    !Number.isFinite(inches) || inches < 0 || inches >= 12
  ) {
    throw new Error("Enter whole feet and inches from 0 up to less than 12.");
  }
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}

export function centimetersToFeetInches(cm: number): { feet: number; inches: number } {
  if (!Number.isFinite(cm) || cm <= 0) {
    throw new Error("Enter a valid height in centimetres.");
  }
  // Round to the nearest tenth of an inch and carry 12.0 in into another foot.
  const tenthsOfInch = Math.round((cm / 2.54) * 10);
  const feet = Math.floor(tenthsOfInch / 120);
  const inches = (tenthsOfInch - feet * 120) / 10;
  return { feet, inches };
}
