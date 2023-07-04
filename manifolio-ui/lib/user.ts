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

// TODO should this be UserModel?
export class UserModel {
  balance: number;
  filledBets: BetModel[];

  constructor(balance: number, filledBets: BetModel[]) {
    this.balance = balance;
    this.filledBets = filledBets;
  }
}

export const buildUserModel = async (
  username: string
): Promise<UserModel | undefined> => {
  const api = getManifoldApi();

  const manifoldUser = api.getUser({ username });
};
