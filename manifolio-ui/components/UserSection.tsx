import React, { useEffect, useState } from "react";
import { UserModel, buildUserModel } from "@/lib/user";
import { InputField } from "@/components/InputField";
import { createUseStyles } from "react-jss";
import { useLocalStorageState } from "./hooks/useLocalStorageState";

const useStyles = createUseStyles(() => ({
  inputSection: {
    display: "flex",
    flexDirection: "row",
  },
  inputField: {
    flex: 1,
  },
}));

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
  const classes = useStyles();

  const [usernameInput, setUsernameInput] = useLocalStorageState<
    string | undefined
  >("usernameInput", undefined);
  const [foundUser, setFoundUser] = useState<boolean>(false);

  // Fetch the authenticated user
  useEffect(() => {
    if (!apiKeyInput || apiKeyInput.length == 0) return;

    const tryFetchUser = async (apiKey: string) => {
      const res = await fetch("/api/me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
        }),
      });

      const { username: authedUsername } = await res.json();

      if (!authedUsername) return;

      setFoundAuthedUser(true);
      setUsernameInput(authedUsername);
    };
    void tryFetchUser(apiKeyInput);
  }, [apiKeyInput, setFoundAuthedUser, setUsernameInput]);

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

  const userInputStatus = foundUser
    ? "success"
    : usernameInput
    ? "error"
    : undefined;

  const apiKeyInputStatus = foundAuthedUser
    ? "success"
    : apiKeyInput
    ? "error"
    : undefined;

  return (
    <>
      <div className={classes.inputSection}>
        <InputField
          label="User"
          id="usernameInput"
          type="text"
          placeholder="Url or username"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          status={userInputStatus}
          disabled={!!apiKeyInput && apiKeyInput.length > 0}
          className={classes.inputField}
        />
        <InputField
          label="API key (optional)"
          id="apiKeyInput"
          type="text"
          placeholder='Find in "Edit Profile" on Manifold'
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          status={apiKeyInputStatus}
          className={classes.inputField}
        />
      </div>
      {userModel && (
        <div>
          <p>Balance: M{userModel.balance.toFixed(0)}</p>
          <p>Total loans: M{userModel.loans.toFixed(0)}</p>
          <p>Balance after loans: M{userModel.balanceAfterLoans.toFixed(0)}</p>
          <p>Portfolio value: M{userModel.portfolioEV.toFixed(0)}</p>
        </div>
      )}
    </>
  );
};
