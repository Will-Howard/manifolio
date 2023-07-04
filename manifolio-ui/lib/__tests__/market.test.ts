import { buildCpmmMarketModel } from "../market";

// Slightly hacky to use the live api in tests, this this won't change very often
const highActivityMarket = "will-biden-be-the-2024-democratic-n";

test("Tests for converting data from the manifold api into a static CpmmMarketModel", async () => {
  const marketModel = await buildCpmmMarketModel(highActivityMarket);

  expect(marketModel).toBeDefined();
  expect(marketModel.bets.length).toBeGreaterThan(10000);
  // no duplicate bet ids
  const betIds = marketModel.bets.map((bet) => bet.id);
  expect(betIds.length).toBe(new Set(betIds).size);

  // getBetInfo passes sanity check (that the probability goes up after betting YES)
  const { probAfter } = marketModel.getBetInfo("YES", 100);
  expect(probAfter).toBeGreaterThan(marketModel.market.probability);
}, 30000);
