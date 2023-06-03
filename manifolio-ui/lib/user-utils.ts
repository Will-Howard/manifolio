import { getManifoldApi } from "./manifold-api";
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
