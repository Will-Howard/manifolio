import { inspect } from "util";

export const formatInt = (n: number | undefined): string => {
  if (n === undefined) {
    // em-dash
    return "—";
  }

  return parseInt(n.toFixed(0)).toLocaleString();
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
