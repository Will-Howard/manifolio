import { buildUserModel } from "../user";

// FIXME Slightly hacky to use the live api in tests
const highActivityUser = "WilliamHoward";

test("Tests for converting data from the manifold api into a static UserModel", async () => {
  const userModel = await buildUserModel(highActivityUser);

  expect(userModel.positions.length).toBeGreaterThan(1);
}, 30000);
