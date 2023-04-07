export function assertDefined<T>(value: T | undefined): value is T {
  if (value === undefined) {
    throw new Error("Value is undefined");
  }
  return true;
}

export const assertAllDefined = <T>(
  values: (T | undefined)[]
): values is T[] => {
  return values.every(assertDefined);
};
