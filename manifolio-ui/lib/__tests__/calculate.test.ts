import { calculateNaiveKellyBet } from "@/lib/calculate";

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
