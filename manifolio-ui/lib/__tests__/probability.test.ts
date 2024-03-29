import {
  PositionModel,
  CDF,
  computeCumulativeDistribution,
  computeExpectedValue,
  computePayoutDistribution,
  integrateOverPmf,
} from "../probability";

/**
 * Assert the expected value you get from sampling is approximately the same as the expected value given.
 * This function uses adaptive sampling to reduce the number of trials needed in the success case.
 */
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
    const bets: PositionModel[] = [
      { probability: 0.3, payout: 2 },
      { probability: 0.5, payout: 3 },
    ];

    // Calculate the combined probability distribution
    const payoutDistCart = computePayoutDistribution(bets, "cartesian");
    const payoutDistMC = computePayoutDistribution(bets, "monte-carlo");

    // Sum over the probabilities to check that they add up to 1
    assertValidDistribution(payoutDistCart);
    assertValidDistribution(payoutDistMC);

    // Check that the expected values are the same
    const expectedValueCart = computeExpectedValue(payoutDistCart);
    const expectedValueMC = computeExpectedValue(payoutDistMC);
    expect(Math.abs(expectedValueCart - expectedValueMC)).toBeLessThan(0.1);

    // Check that we get the same result by sampling
    assertExpectedValueEqual({
      expectedValue: expectedValueCart,
      sampleCallback: () => {
        let totalPayout = 0;
        // rejection sampling
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

  test("For small number of bets: combined cumulative distribution is as expected from manual calculation", () => {
    const bets: PositionModel[] = [
      { probability: 0.3, payout: 2 },
      { probability: 0.5, payout: 3 },
    ];

    // Calculate the combined cumulative distribution
    const cumDistCart: CDF = computeCumulativeDistribution(bets, "cartesian"); // cartesian one is correct currently

    expect(Object.fromEntries(cumDistCart)).toStrictEqual({
      0: 0.35,
      2: 0.5,
      3: 0.85,
      5: 1,
    });
  });

  test("Calculating expected value by integrating over a probability mass function works", () => {
    const bets: PositionModel[] = [
      { probability: 0.3, payout: 2 },
      { probability: 0.5, payout: 3 },
    ];

    const payoutDistCart = computePayoutDistribution(bets, "cartesian");

    const expectedValue = integrateOverPmf((payout) => payout, payoutDistCart);
    expect(expectedValue).toBeCloseTo(2.1);

    const nonTrivialEV = integrateOverPmf(
      (payout) => payout * payout,
      payoutDistCart
    );
    expect(nonTrivialEV).toBeCloseTo(7.5);
  });
});
