import { inspect } from "util";

export const formatInt = (n: number | undefined): string => {
  if (n === undefined) {
    // em-dash
    return "—";
  }

  return parseInt(n.toFixed(0)).toLocaleString();
};

// Superscript lookup table
const superscripts: { [key: number]: string } = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
};
export const formatRoi = (roi?: number) => {
  if (roi === undefined) return "—";

  const roiPercent = (roi - 1) * 100;
  if (Math.abs(roiPercent) < 0.01) return "0%"; // Avoid -0.0%

  // Format number into scientific notation
  const toScientificNotation = (num: number) => {
    const logValue = Math.floor(Math.log10(Math.abs(num)));
    const coefficient = num / Math.pow(10, logValue);
    const exponentStr = String(logValue)
      .split("")
      .map((digit) => superscripts[+digit])
      .join("");
    return `${coefficient.toFixed(2)}×10${exponentStr}`;
  };

  // Check if the number is very large and format accordingly
  if (Math.abs(roiPercent) >= 1e3) {
    return `${toScientificNotation(roiPercent)}% per year`;
  }

  // 1 decimal place if it's less than 10%, 2 if it's less than 1%, 0 otherwise
  const decimalPlaces = roiPercent < 1 ? 2 : roiPercent < 10 ? 1 : 0;

  // Also format with commas
  return `${parseFloat(
    roiPercent.toFixed(decimalPlaces)
  ).toLocaleString()}% per year`;
};

export async function executePromiseQueue<T>(
  promiseGenerators: (() => Promise<T>)[],
  maxConcurrent: number
): Promise<T[]> {
  let queue: Promise<T>[] = [];
  const results: Promise<T>[] = [];

  // Execute up to maxConcurrent queries at a time
  for (const promiseGenerator of promiseGenerators) {
    // Add the new promise to the queue
    const promise = promiseGenerator();
    queue.push(promise);
    results.push(promise);

    // If the queue is full, wait for one promise to finish
    if (queue.length >= maxConcurrent) {
      await Promise.race(queue);
      // Remove resolved promises from the queue
      queue = queue.filter((p) => inspect(p).includes("pending"));
    }
  }

  // Wait for all remaining promises to finish
  await Promise.all(queue);
  return Promise.all(results);
}

export async function executeChunkedQueue<T, V>(
  func: (chunk: V[]) => Promise<T[]>,
  values: V[],
  chunkSize = 200,
  maxConcurrent = 4
): Promise<T[]> {
  const chunks = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  const promiseGenerators = chunks.map((chunk) => () => func(chunk));
  return (await executePromiseQueue(promiseGenerators, maxConcurrent)).flat();
}
