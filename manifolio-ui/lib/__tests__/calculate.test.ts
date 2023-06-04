import { calculateNaiveKellyBet, findRoot } from "@/lib/calculate";

test("Naive Kelly formula gives expected result", () => {
  const { amount, outcome } = calculateNaiveKellyBet({
    marketProb: 0.5,
    estimatedProb: 0.6,
    deferenceFactor: 0.5,
    bankroll: 100,
  });
  expect({ amount: amount.toPrecision(5), outcome }).toMatchInlineSnapshot(`
    {
      "amount": "10.000",
      "outcome": "YES",
    }
  `);
});

describe("Equation solvers work correctly", () => {
  test("Root solver works with multiple cases", async () => {
    // Test 1: Function with a single root at x = 2
    const f1 = async (x: number) => x - 2;
    let solution = await findRoot(f1, 1, 3);
    expect(Math.abs(solution - 2)).toBeLessThan(1e-6);

    // Test 2: Decreasing function with a single root at x = 1
    const f2 = async (x: number) => 1 - x;
    solution = await findRoot(f2, 0, 2);
    expect(Math.abs(solution - 1)).toBeLessThan(1e-6);

    // Test 3: Function with root at the boundary (x = 1)
    const f3 = async (x: number) => x - 1;
    solution = await findRoot(f3, 1, 3);
    expect(Math.abs(solution - 1)).toBeLessThan(1e-6);

    // Test 4: Function with multiple roots (x = 1 and x = 2)
    const f4 = async (x: number) => (x - 1) * (x - 2);
    solution = await findRoot(f4, 0, 1.5);
    expect(Math.abs(solution - 1)).toBeLessThan(1e-6);
    solution = await findRoot(f4, 1.5, 3);
    expect(Math.abs(solution - 2)).toBeLessThan(1e-6);
  });
});
