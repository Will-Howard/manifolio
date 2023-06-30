import { getManifoldApi } from "./manifold-api";
import type { BetModel } from "./probability";
import { User } from "./vendor/manifold-sdk";

export const fetchUser = async (
  username: string
): Promise<User | undefined> => {
  try {
    const fetchedUser = await getManifoldApi().getUser({ username });
    return fetchedUser;
  } catch (e) {
    console.error(e);
    return undefined;
  }
};

export class PortfolioModel {
  balance: number;
  illiquidPortfolio: BetModel[];

  constructor(balance: number, illiquidPortfolio: BetModel[]) {
    this.balance = balance;
    this.illiquidPortfolio = illiquidPortfolio;
  }

  // TODO implement
  // static fromUser(user: User): PortfolioModel {
  //   // TODO not implemented yet
  //   return new PortfolioModel(0, []);
  // }
}
