import { calculateNaiveKellyBet } from "@/lib/calculate";

test("Naive Kelly formula gives expected result", () => {
  expect(
    calculateNaiveKellyBet({
      marketProb: 0.5,
      estimatedProb: 0.6,
      deferenceFactor: 0.5,
      bankroll: 100,
    })
  ).toMatchInlineSnapshot(`
    {
      "amount": 9.999999999999998,
      "outcome": "YES",
    }
  `);
});
