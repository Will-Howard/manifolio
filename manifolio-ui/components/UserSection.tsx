import React, { useEffect, useState } from "react";
import { UserModel, buildUserModel, getAuthedUsername } from "@/lib/user";
import { InputField } from "@/components/InputField";

interface UserSectionProps {
  apiKeyInput?: string;
  setApiKeyInput: React.Dispatch<React.SetStateAction<string | undefined>>;
  foundAuthedUser: boolean;
  setFoundAuthedUser: React.Dispatch<React.SetStateAction<boolean>>;
  userModel?: UserModel;
  setUserModel: React.Dispatch<React.SetStateAction<UserModel | undefined>>;
}

export const UserSection: React.FC<UserSectionProps> = ({
  apiKeyInput,
  setApiKeyInput,
  setFoundAuthedUser,
  userModel,
  setUserModel,
  foundAuthedUser,
}) => {
  const [usernameInput, setUsernameInput] = useState<string>("WilliamHoward");
  const [foundUser, setFoundUser] = useState<boolean>(false);

  // Fetch the authenticated user
  useEffect(() => {
    if (!apiKeyInput || apiKeyInput.length == 0) return;

    const tryFetchUser = async (apiKey: string) => {
      const authedUsername = await getAuthedUsername(apiKey);

      if (!authedUsername) return;

      setFoundAuthedUser(true);
      setUsernameInput(authedUsername);
    };
    void tryFetchUser(apiKeyInput);
  }, [apiKeyInput, setFoundAuthedUser]);

  // Fetch the user
  useEffect(() => {
    if (!usernameInput || usernameInput.length == 0) return;
    const parsedUsername = usernameInput.split("/").pop() || "";

    const tryFetchUser = async (username: string) => {
      const userModel = await buildUserModel(username);

      setFoundUser(!!userModel);
      setUserModel(userModel);
    };
    void tryFetchUser(parsedUsername);
  }, [setUserModel, usernameInput]);

  return (
    <>
      <InputField
        label="User:"
        id="usernameInput"
        type="text"
        placeholder="e.g. @WilliamHoward or https://manifold.markets/WilliamHoward"
        value={usernameInput}
        onChange={(e) => setUsernameInput(e.target.value)}
        status={foundUser ? "success" : "error"}
        disabled={!!apiKeyInput && apiKeyInput.length > 0}
      />
      <InputField
        label="API key (optional):"
        id="apiKeyInput"
        type="text"
        placeholder='Find in "Edit Profile" on Manifold'
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        status={
          apiKeyInput !== undefined && apiKeyInput.length > 0
            ? foundAuthedUser
              ? "success"
              : "error"
            : undefined
        }
      />
      {userModel && (
        <div>
          <p>Balance: {userModel.balance.toFixed(0)}</p>
          <p>Total loans: {userModel.loans.toFixed(0)}</p>
          <p>Balance net of loans: {userModel.balanceAfterLoans.toFixed(0)}</p>
          <p>Portfolio value: {userModel.portfolioEV.toFixed(0)}</p>
        </div>
      )}
    </>
  );
};
