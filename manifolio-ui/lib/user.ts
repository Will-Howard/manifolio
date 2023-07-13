import { Dictionary, groupBy } from "lodash";
import { getManifoldApi, initManifoldApi } from "./manifold-api";
import type { PositionModel as PositionModel } from "./probability";
import { Manifold, type Bet, type User } from "./vendor/manifold-sdk";

export class UserModel {
  balance: number;
  loans: number;
  balanceAfterLoans: number;
  positions: PositionModel[];
  illiquidEV: number;
  portfolioEV: number;

  constructor(balance: number, loans: number, positions: PositionModel[]) {
    this.balance = balance;
    this.loans = loans;
    this.positions = positions;
    this.balanceAfterLoans = balance - loans;
    this.illiquidEV = positions.reduce(
      (acc, position) => acc + position.probability * position.payout,
      0
    );
    this.portfolioEV = this.balanceAfterLoans + this.illiquidEV;
  }
}

export const buildUserModel = async (
  username: string
): Promise<UserModel | undefined> => {
  const api = getManifoldApi();

  let manifoldUser: User | undefined;
  try {
    manifoldUser = await api.getUser({ username });
  } catch (e) {
    console.error(e);
    return undefined;
  }

  // Fetch bets with pagination
  // TODO combine with market.ts
  const allBets: Bet[] = [];
  let before: string | undefined = undefined;

  while (true) {
    const bets = await api.getBets({ username, before, limit: 1000 });
    allBets.push(...bets);

    // Break if:
    // - The latest page of bets is less than 1000 (indicating that there are no more pages)
    // - There are no bets at all
    // - There are no bets in the latest page (if the last page happened to be exactly 1000 bets)
    if (bets.length < 1000 || allBets.length === 0 || allBets.length === 0) {
      break;
    }

    before = allBets[allBets.length - 1].id;
  }

  // Fetch all the users bets, then construct positions from them
  // Note 1: partially filled bets still have the correct "amount" and "shares" fields
  // Note 2: including cancelled bets is also fine, this just refers to whether _new_ fills are cancelled
  const cpmmBets = allBets.filter(
    (bet) => bet.isFilled !== undefined || bet.amount < 0
  );
  // TODO handle these in some way
  const nonCpmmBets = allBets.filter(
    (bet) => bet.isFilled === undefined && bet.amount > 0
  );
  const betsByMarket = groupBy(cpmmBets, (bet) => bet.contractId);

  const cleanedContractsBetOn: Dictionary<{
    contractId: string;
    netYesShares: number;
    netLoan: number;
    evEstimate: number;
  }> = {};

  for (const marketId in betsByMarket) {
    const bets = betsByMarket[marketId].sort(
      (a, b) => b.createdTime - a.createdTime
    );
    const mostRecentProb = bets[0].probAfter;

    const netYesShares = bets.reduce((acc, bet) => {
      if (bet.outcome === "YES") {
        return acc + bet.shares;
      } else {
        return acc - bet.shares;
      }
    }, 0);
    const netLoan = bets.reduce((acc, bet) => acc + (bet.loanAmount ?? 0), 0);

    if (Math.abs(netYesShares) >= 1) {
      cleanedContractsBetOn[marketId] = {
        contractId: marketId,
        netYesShares: netYesShares,
        netLoan,
        // this is really just here for information architecture reasons, it's not necessary atm
        evEstimate: mostRecentProb * netYesShares,
      };
    }
  }

  const contractsByEstEV = Object.values(cleanedContractsBetOn).sort(
    (a, b) => b.evEstimate - a.evEstimate
  );

  const markets = await Promise.all(
    contractsByEstEV.map(({ contractId }) => api.getMarket({ id: contractId }))
  );

  const openMarkets = markets.filter(
    (market) =>
      market.isResolved === false &&
      market.closeTime &&
      market.closeTime > Date.now()
  );

  const positions = openMarkets.map((market) => {
    const bet = cleanedContractsBetOn[market.id];
    const isYesBet = bet.netYesShares > 0;

    const probability = isYesBet ? market.probability : 1 - market.probability;
    const payout = Math.abs(bet.netYesShares);

    return {
      probability,
      payout,
      loan: bet.netLoan,
      // ev: probability * payout, // DEBUG
    };
  });

  const loans = positions.reduce((acc, pos) => acc + (pos.loan ?? 0), 0);

  return new UserModel(manifoldUser.balance, loans, positions);
};

export const getAuthedUsername = async (
  apiKey: string
): Promise<string | undefined> => {
  const api = new Manifold(apiKey);

  try {
    const user = await api.getMe();
    return user?.username;
  } catch (e) {
    return undefined;
  }
};
