import { buildUserModel } from "../user";

// Slightly hacky to use the live api in tests, this this won't change very often
const highActivityUser = "WilliamHoward";

test("Tests for converting data from the manifold api into a static UserModel", async () => {
  const userModel = await buildUserModel(highActivityUser);

  const sortedPositions = userModel.filledPositions.sort(
    (a, b) => b.probability * b.payout - a.probability * a.payout
  );

  expect(sortedPositions.length).toBeGreaterThan(1);
  expect(
    sortedPositions[0].payout * sortedPositions[0].probability
  ).toBeGreaterThan(sortedPositions[1].payout * sortedPositions[1].probability);
}, 30000);
