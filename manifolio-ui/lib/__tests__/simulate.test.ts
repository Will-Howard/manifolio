// Tests that the recommendation algorithm does actually optimise log
// wealth. Note: some of these may be slow

import {
  Outcome,
  calculateNaiveKellyBet,
  getBetRecommendation,
} from "../calculate";
import { CpmmMarketModel } from "../market";
import { PositionModel } from "../probability";
import { UserModel } from "../user";
import { v4 as uuidv4 } from "uuid";
import { LimitBet, binarySearch } from "../vendor/manifold-helpers";
import { Bet, FullMarket } from "../vendor/manifold-sdk";

const createDummyUserModel = ({
  balance = 1000,
  loans = 0,
  positions = [],
}: {
  balance?: number;
  loans?: number;
  positions?: PositionModel[];
}) => {
  const user = {
    id: "dvyndGIydhZDv2lQz0ddqYAmRPw2",
    createdTime: 1671313703455,
    name: "William Howard",
    username: "WilliamHoward",
    url: "https://dev.manifold.markets/WilliamHoward",
    avatarUrl:
      "https://lh3.googleusercontent.com/a/AEdFTp7F19QuFP94hsMnIlnRZr6T_F41iaAbsLefP7oK=s96-c",
    balance: balance,
    totalDeposits: 1017.75,
    profitCached: {
      daily: 13.74623948517197,
      allTime: 14.075639008961844,
      monthly: 13.746239485171914,
      weekly: 13.746239485171946,
    },
    isBot: false,
    isAdmin: false,
    isTrustworthy: false,
    followerCountCached: 0,
    currentBettingStreak: 2,
    lastBetTime: 1689794240042,
  };

  // PositionModel is missing the contractId and outcome fields,
  // add dummy values to ones that are missing these
  const manifoldPositions = positions.map((pos) => ({
    ...pos,
    contractId: uuidv4(),
    outcome: "YES" as Outcome,
  }));

  return new UserModel(user, balance, loans, manifoldPositions);
};

const createDummyMarketModel = ({
  probability,
  liquidity,
  p = 0.5,
  bets = [],
  balanceByUserId = {},
}: {
  probability: number;
  liquidity: number;
  p?: number;
  bets?: Omit<
    LimitBet,
    "id" | "contractId" | "createdTime" | "probBefore" | "probAfter"
  >[];
  balanceByUserId?: { [userId: string]: number };
}) => {
  // liquidity is the number returned by this function:
  // function getCpmmLiquidity(pool: { [outcome: string]: number }, p: number) {
  //   const { YES, NO } = pool;
  //   // Note: if YES == NO then this == YES
  //   return YES ** p * NO ** (1 - p);
  // }
  // We want to get from (p, liquidity) to (YES, NO)
  // L = y^p * n^(1-p)
  // prob = (p * n) / ((1 - p) * y + p * n)
  // => ((1 - p) * y + p * n) = (p * n) / prob
  // => (1 - p) * y = (p * n) / prob - p * n
  // => y = ((p * n) / prob - p * n) / (1 - p)
  //
  // y^p = L / n^(1-p)
  // => y = (L / n^(1-p))^(1/p) = ((p * n) / prob - p * n) / (1 - p)
  // => 0 = (L / n^(1-p))^(1/p) - ((p * n) / prob - p * n) / (1 - p)
  // constraints:
  // 0 < p < 1
  // 0 < prob < 1
  // 0 < L
  // 0 < n

  const comparator = (n: number) => {
    // (L / n^(1-p))^(1/p) - ((p * n) / prob - p * n) / (1 - p)
    const lhTerm = Math.pow(liquidity / Math.pow(n, 1 - p), 1 / p);
    const rhTerm = ((p * n) / probability - p * n) / (1 - p);

    // negative sign is due to peculiarities of binary search
    return -(lhTerm - rhTerm);
  };

  const NO = binarySearch(1e-6, liquidity * 1e5, comparator);
  // y = ((p * n) / prob - p * n) / (1 - p)
  const YES = ((p * NO) / probability - p * NO) / (1 - p);

  const market: FullMarket = {
    id: "TbZ76Pypnc37BXO0CZ8d",
    // creatorId: "PP20ggPLL0bVdF9vI1U205P8pR63",
    creatorUsername: "Austin",
    creatorName: "Austin",
    createdTime: 1661218166837,
    creatorAvatarUrl:
      "https://lh3.googleusercontent.com/a-/AOh14GiZyl1lBehuBMGyJYJhZd-N-mstaUtgE4xdI22lLw=s96-c",
    closeTime: 1700000000000,
    question: "[API] Is there life on Mars? 2",
    url: "https://dev.manifold.markets/Austin/api-is-there-life-on-mars-2",
    pool: {
      // NO: 181.43608911997936,
      // YES: 114.74447527883981,
      NO,
      YES,
    },
    // probability: 0.39123208181613767,
    probability,
    p,
    totalLiquidity: liquidity,
    outcomeType: "BINARY",
    mechanism: "cpmm-1",
    volume: 50,
    volume24Hours: 0,
    isResolved: false,
    // lastUpdatedTime: 1684703688940,
    description: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              text: "Will the following EA Forum post win $15k or more in the Cause Exploration Prizes?",
              type: "text",
            },
          ],
        },
      ],
    },
    textDescription:
      "Will the following EA Forum post win $15k or more in the Cause Exploration Prizes?\n\n(https://forum.effectivealtruism.org/posts/majcwf7i8pW8eMJ3v/new-cause-area-violence-against-women-and-girls)",
    tags: [],
    volume7Days: 50,
  };

  return new CpmmMarketModel({
    market,
    bets: bets as Bet[],
    balanceByUserId,
  });
};

test("Test for getBetRecommendation under basic Kelly betting scenario (high liquidity, no limit bets)", async () => {
  const balance = 100;
  const testCount = 100;

  for (let i = 0; i < testCount; i++) {
    const marketProb = Math.random() * 0.98 + 0.01; // Random value between 0.01 and 0.99
    const estimatedProb = Math.random() * 0.98 + 0.01; // Random value between 0.01 and 0.99
    const deferenceFactor = Math.random() * 0.98 + 0.01; // Random value between 0.01 and 0.99

    // Create market model with very high liquidity
    const marketModel = createDummyMarketModel({
      probability: marketProb,
      liquidity: 100_000,
      p: 0.5,
    });

    // Create user model with fairly low balance, no loans or positions
    const userModel = createDummyUserModel({
      balance,
      positions: [],
    });

    const { amount: naiveKellyAmount, outcome: naiveKellyOutcome } =
      calculateNaiveKellyBet({
        marketProb,
        estimatedProb,
        deferenceFactor,
        bankroll: balance,
      });

    const { amount: fullRecAmount, outcome: fullRecOutcome } =
      getBetRecommendation({
        estimatedProb,
        deferenceFactor,
        marketModel,
        userModel,
      });

    expect(naiveKellyOutcome).toBe(fullRecOutcome);
    expect(Math.abs(naiveKellyAmount - fullRecAmount)).toBeLessThan(
      (fullRecAmount + naiveKellyAmount) / 100
    );
  }
});

test("Test for getBetRecommendation with low liquidity, but a limit bet", async () => {
  const balance = 1000;

  const marketProb = 0.6;
  const estimatedProb = 0.8;
  const deferenceFactor = 1;

  // Create market model with low high liquidity
  const marketModel = createDummyMarketModel({
    probability: marketProb,
    liquidity: 100,
    p: 0.5,
    bets: [
      {
        amount: 0, // this is the amount that has been filled
        shares: 0,
        orderAmount: 1000,
        outcome: "NO",
        limitProb: marketProb,
        isFilled: false,
        isCancelled: false,
        userId: "counterparty-user",
        fills: [],
      },
    ],
    balanceByUserId: {
      "counterparty-user": 1000,
    },
  });

  // Create user model with fairly high balance
  const userModel = createDummyUserModel({
    balance,
    positions: [],
  });

  const { amount: naiveKellyAmount, outcome: naiveKellyOutcome } =
    calculateNaiveKellyBet({
      marketProb,
      estimatedProb,
      deferenceFactor,
      bankroll: balance,
    });

  const { amount: fullRecAmount, outcome: fullRecOutcome } =
    getBetRecommendation({
      estimatedProb,
      deferenceFactor,
      marketModel,
      userModel,
    });

  expect(naiveKellyOutcome).toBe(fullRecOutcome);
  expect(Math.abs(naiveKellyAmount - fullRecAmount)).toBeLessThan(
    (fullRecAmount + naiveKellyAmount) / 100
  );
});

describe("Direct tests for maximising log wealth under scenarios with no other positions", () => {
  test("High liquidity (for sanity check)", async () => {
    const balance = 100;
    const marketProb = 0.01 + Math.random() * 0.98;
    const estimatedProb = 0.01 + Math.random() * 0.98;
    const deferenceFactor = 0.01 + Math.random() * 0.98;

    // Create market model with very high liquidity
    const marketModel = createDummyMarketModel({
      probability: marketProb,
      liquidity: 100_000,
      p: 0.5,
    });

    // Create user model with fairly low balance, no loans or positions
    const userModel = createDummyUserModel({
      balance,
      positions: [],
    });

    const { amount, outcome } = getBetRecommendation({
      estimatedProb,
      deferenceFactor,
      marketModel,
      userModel,
    });

    const getExpectedLogWealth = (betAmount: number) => {
      const { newShares } = marketModel.getBetInfo(outcome, betAmount);
      const instances = 100_000;
      const finalWealths = [];

      const deferenceAdjustedProb =
        deferenceFactor * estimatedProb + (1 - deferenceFactor) * marketProb;
      const winProb =
        outcome === "YES" ? deferenceAdjustedProb : 1 - deferenceAdjustedProb;
      for (let i = 0; i < instances; i++) {
        const finalWeath =
          balance - betAmount + newShares * (Math.random() < winProb ? 1 : 0);
        finalWealths.push(finalWeath);
      }
      const expectedLogWealth =
        finalWealths.reduce((acc, wealth) => acc + Math.log(wealth), 0) /
        instances;
      return expectedLogWealth;
    };

    const expectedLogWealth = getExpectedLogWealth(amount);
    const variations = [-10, 10];

    for (const variation of variations) {
      const newAmount = Math.min(Math.max(amount + variation, 0), balance);
      const variationExpectedLogWealth = getExpectedLogWealth(newAmount);
      expect(expectedLogWealth).toBeGreaterThan(variationExpectedLogWealth);
    }
  });

  test("Low liquidity market", async () => {
    const balance = 1000;
    const marketProb = 0.01 + Math.random() * 0.98;
    const estimatedProb = 0.01 + Math.random() * 0.98;
    const deferenceFactor = 0.01 + Math.random() * 0.98;

    // Create market model with very high liquidity
    const marketModel = createDummyMarketModel({
      probability: marketProb,
      liquidity: 100,
      p: 0.5,
    });

    // Create user model with fairly low balance, no loans or positions
    const userModel = createDummyUserModel({
      balance,
      positions: [],
    });

    const { amount, outcome } = getBetRecommendation({
      estimatedProb,
      deferenceFactor,
      marketModel,
      userModel,
    });

    const getExpectedLogWealth = (betAmount: number) => {
      const { newShares } = marketModel.getBetInfo(outcome, betAmount);
      const instances = 100_000;
      const finalWealths = [];

      const deferenceAdjustedProb =
        deferenceFactor * estimatedProb + (1 - deferenceFactor) * marketProb;
      const winProb =
        outcome === "YES" ? deferenceAdjustedProb : 1 - deferenceAdjustedProb;
      for (let i = 0; i < instances; i++) {
        const finalWeath =
          balance - betAmount + newShares * (Math.random() < winProb ? 1 : 0);
        finalWealths.push(finalWeath);
      }
      const expectedLogWealth =
        finalWealths.reduce((acc, wealth) => acc + Math.log(wealth), 0) /
        instances;
      return expectedLogWealth;
    };

    const expectedLogWealth = getExpectedLogWealth(amount);
    const variations = [-10, 10];

    for (const variation of variations) {
      const newAmount = Math.min(Math.max(amount + variation, 0), balance);
      const variationExpectedLogWealth = getExpectedLogWealth(newAmount);
      expect(expectedLogWealth).toBeGreaterThan(variationExpectedLogWealth);
    }
  });
});

describe("Direct test for maximising log wealth under scenarios with other positions and loans", () => {
  test("High liquidity market, low risk positions, low loans. Recommendation should be close to 'portfolioEV as balance' in this case", async () => {
    const balance = 100;
    const loans = 10;

    const marketProb = 0.01 + Math.random() * 0.98;
    const estimatedProb = 0.01 + Math.random() * 0.98;
    const deferenceFactor = 0.01 + Math.random() * 0.98;

    // Create market model with very high liquidity
    const marketModel = createDummyMarketModel({
      probability: marketProb,
      liquidity: 100_000,
      p: 0.5,
    });

    // EV of M1 per position, for total of M20
    const positions = Array.from({ length: 20 }, () => ({
      probability: 0.5,
      payout: 2,
    }));

    // Create user model with fairly low balance, no loans or positions
    const userModel = createDummyUserModel({
      balance,
      loans,
      positions: positions,
    });

    const portfolioEV = userModel.portfolioEV;
    expect(portfolioEV).toBeCloseTo(balance - loans + 20);

    const userModelSimple = createDummyUserModel({
      balance: balance - loans + 20,
      loans: 0,
      positions: [],
    });

    const { amount: amountFull, outcome: outcomeFull } = getBetRecommendation({
      estimatedProb,
      deferenceFactor,
      marketModel,
      userModel,
    });

    const { amount: amountSimple, outcome: outcomeSimple } =
      getBetRecommendation({
        estimatedProb,
        deferenceFactor,
        marketModel,
        userModel: userModelSimple,
      });

    expect(outcomeFull).toBe(outcomeSimple);
    expect(Math.abs(amountFull - amountSimple)).toBeLessThan(
      (amountFull + amountSimple) / 100
    );
    // Bonus, the full version should be ever so slightly lower
    expect(amountFull).toBeLessThan(amountSimple);
  });

  test("High liquidity market, high risk positions, high loans. Recommendation should be much lower than 'portfolioEV as balance'", async () => {
    const balance = 100;
    const loans = 80;

    const marketProb = 0.01 + Math.random() * 0.98;
    const estimatedProb = 0.01 + Math.random() * 0.98;
    const deferenceFactor = 0.01 + Math.random() * 0.98;

    // Create market model with very high liquidity
    const marketModel = createDummyMarketModel({
      probability: marketProb,
      liquidity: 100_000,
      p: 0.5,
    });

    // EV of M50 per position, for total of M100
    const positions = Array.from({ length: 2 }, () => ({
      probability: 0.5,
      payout: 100,
    }));

    // Create user model with fairly low balance, no loans or positions
    const userModel = createDummyUserModel({
      balance,
      loans,
      positions: positions,
    });

    const portfolioEV = userModel.portfolioEV;
    expect(portfolioEV).toBeCloseTo(balance - loans + 100);

    const userModelSimple = createDummyUserModel({
      balance: balance - loans + 100,
      loans: 0,
      positions: [],
    });

    const { amount: amountFull, outcome: outcomeFull } = getBetRecommendation({
      estimatedProb,
      deferenceFactor,
      marketModel,
      userModel,
    });

    const { amount: amountSimple, outcome: outcomeSimple } =
      getBetRecommendation({
        estimatedProb,
        deferenceFactor,
        marketModel,
        userModel: userModelSimple,
      });

    expect(outcomeFull).toBe(outcomeSimple);
    expect(Math.abs(amountFull - amountSimple)).toBeGreaterThan(
      (amountFull + amountSimple) / 10
    );
    // Plus the full version should be lower
    expect(amountFull).toBeLessThan(amountSimple);

    const getExpectedLogWealth = (betAmount: number) => {
      const { newShares } = marketModel.getBetInfo(outcomeFull, betAmount);
      const deferenceAdjustedProb =
        deferenceFactor * estimatedProb + (1 - deferenceFactor) * marketProb;
      const winProb =
        outcomeFull === "YES"
          ? deferenceAdjustedProb
          : 1 - deferenceAdjustedProb;

      const newPosition = {
        probability: winProb,
        payout: newShares,
      };
      const allPositions = [...positions, newPosition];

      const instances = 100_000;
      const finalWealths = [];

      for (let i = 0; i < instances; i++) {
        let samplePayout = 0;
        for (const position of allPositions) {
          if (Math.random() <= position.probability) {
            samplePayout += position.payout;
          }
        }

        const finalWealth = balance - loans - betAmount + samplePayout;
        finalWealths.push(finalWealth);
      }
      const expectedLogWealth =
        finalWealths.reduce((acc, wealth) => acc + Math.log(wealth), 0) /
        instances;
      return expectedLogWealth;
    };

    const expectedLogWealth = getExpectedLogWealth(amountFull);
    const variations = [-2, -1, 1, 2];

    for (const variation of variations) {
      const newAmount = Math.min(
        Math.max(amountFull + variation, 0),
        balance - loans - 0.1
      );
      const variationExpectedLogWealth = getExpectedLogWealth(newAmount);
      expect(variationExpectedLogWealth - expectedLogWealth).toBeLessThan(
        (expectedLogWealth + variationExpectedLogWealth) / 1000
      );
    }
  });

  // TODO currently this is disallowed, add the ability to make it a warning instead
  test("High liquidity market, low risk positions, loans higher than balance. Under strict Kelly betting this should tell you to bet 0, I have chosen to allow it given the positions are low risk enough (TODO this should give a warning though)", async () => {});
});
