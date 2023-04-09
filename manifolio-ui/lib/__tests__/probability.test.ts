import {
  BetModel,
  computeExpectedValue,
  computePayoutDistribution,
  computePayoutDistributionConv,
} from "../probability";

function assertExpectedValueEqual({
  initialSamples = 100,
  maxSamples = 1000,
  targetMarginOfError = 2,
  expectedValue,
  sampleCallback,
}: {
  initialSamples?: number;
  maxSamples?: number;
  targetMarginOfError?: number;
  expectedValue: number;
  sampleCallback: () => number;
}) {
  let sumValues = 0;
  let sumSquaredValues = 0;
  let numSamples = 0;
  let difference = 0;
  let marginOfError = Infinity;

  do {
    // Generate samples
    for (let i = 0; i < initialSamples; i++) {
      const sample = sampleCallback();
      sumValues += sample;
      sumSquaredValues += sample * sample;
      numSamples++;
    }
    const average = sumValues / numSamples;
    const totalVariance = sumSquaredValues / numSamples - average * average;

    // Calculate the margin of error based on the standard error of the mean
    const standardError = Math.sqrt(totalVariance / numSamples);
    marginOfError = targetMarginOfError * standardError;

    // Compare the expected value and the current average
    difference = Math.abs(expectedValue - average);

    // Continue sampling if the difference is too large and the maximum number of samples has not been reached
    // FIXME this will not handle heavy-tailed distributions well
  } while (difference > marginOfError && numSamples < maxSamples);

  expect(difference).toBeLessThanOrEqual(marginOfError);
}

function assertValidDistribution(dist: Map<number, number>) {
  // Sum over the probabilities to check that they add up to 1
  const sumOfProbabilities = Array.from(dist.values()).reduce(
    (acc, probability) => acc + probability,
    0
  );
  expect(sumOfProbabilities).toBeCloseTo(1);
}

describe("Tests for probability logic", () => {
  test("For small number of bets: combined payout distibution is the same using cartesian product, convolutions, and direct sampling", () => {
    // Test function
    const bets: BetModel[] = [
      { probability: 0.3, payout: 2 },
      { probability: 0.5, payout: 3 },
    ];

    // Calculate the combined probability distribution
    const payoutDistCart = computePayoutDistribution(bets, "cartesian");
    const payoutDistConv = computePayoutDistribution(bets, "convolution");

    // Sum over the probabilities to check that they add up to 1
    assertValidDistribution(payoutDistCart);
    assertValidDistribution(payoutDistConv);

    // Check that the expected values are the same
    const expectedValueCart = computeExpectedValue(payoutDistCart);
    const expectedValueConv = computeExpectedValue(payoutDistConv);
    expect(expectedValueCart).toBeCloseTo(expectedValueConv);

    // Check that we get the same result by sampling
    assertExpectedValueEqual({
      expectedValue: expectedValueCart,
      sampleCallback: () => {
        let totalPayout = 0;
        for (const bet of bets) {
          const randomValue = Math.random();
          if (randomValue <= bet.probability) {
            totalPayout += bet.payout;
          }
        }
        return totalPayout;
      },
    });
  });
});