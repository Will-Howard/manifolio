import { buildCpmmMarketModel, fetchMarket } from "../market";

// const highActivityMarket = "will-biden-be-the-2024-democratic-n";
const highActivityMarket = "api-is-there-life-on-mars-2";

test("Tests for converting data from the manifold api into a static CpmmMarketModel", async () => {
  const market = await fetchMarket(highActivityMarket);
  expect(market).toBeDefined();
  if (!market) return;

  const marketModel = await buildCpmmMarketModel(market);

  expect(marketModel).toBeDefined();
  // FIXME this is not true on dev, but check pagination some other way
  // expect(marketModel?.bets.length).toBeGreaterThan(10000);
  // no duplicate bet ids
  const betIds = marketModel?.bets.map((bet) => bet.id);
  expect(betIds?.length).toBe(new Set(betIds).size);

  // getBetInfo passes sanity check (that the probability goes up after betting YES)
  const { probAfter = 0 } = marketModel?.getBetInfo("YES", 100) ?? {};
  expect(probAfter).toBeGreaterThan(
    marketModel?.market?.probability ?? Infinity
  );
}, 30000);
