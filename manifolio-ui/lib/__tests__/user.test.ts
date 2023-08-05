import { buildUserModel, fetchUser } from "../user";

// FIXME Slightly hacky to use the live api in tests
const highActivityUser = "WilliamHoward";

// test("Tests for converting data from the manifold api into a static UserModel", async () => {
//   const user = await fetchUser(highActivityUser);
//   expect(user).toBeDefined();
//   if (!user) return;

//   const userModel = await buildUserModel(user);

//   expect(userModel?.positions.length).toBeGreaterThan(1);
// }, 30000);
