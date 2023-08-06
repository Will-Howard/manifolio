import React, { useCallback, useEffect, useRef, useState } from "react";
import { UserModel, buildUserModel, fetchUser } from "@/lib/user";
import { InputField } from "@/components/InputField";
import { createUseStyles } from "react-jss";
import type { User } from "@/lib/vendor/manifold-sdk";
import { Classes } from "jss";
import type { Theme } from "@/styles/theme";
import classNames from "classnames";
import { useErrors } from "./hooks/useErrors";
import logger from "@/logger";

const useStyles = createUseStyles((theme: Theme) => ({
  inputSection: {
    display: "flex",
    flexDirection: "row",
    gap: "3%",
  },
  inputField: {
    flex: 1,
    // Same width as amount input at full width
    maxWidth: 403,
  },
  profileContainer: {
    display: "flex",
  },
  avatar: {
    borderRadius: "50%",
    margin: "8px 24px 8px 4px",
    objectFit: "cover",
  },
  detailsTitle: {
    fontWeight: 600,
    margin: "4px 0",
  },
  detailsContainer: {
    display: "flex",
    flexDirection: "column",
    maxWidth: 290,
    width: "100%",
  },
  detailsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  value: {
    fontWeight: 600,
  },
  red: {
    color: theme.red,
  },
  green: {
    color: theme.green,
  },
}));

interface DetailProps {
  label: string;
  value: number | undefined;
  isInverse?: boolean;
  loading?: boolean;
  numBetsLoaded?: number;
  classes: Classes;
}

const Detail: React.FC<DetailProps> = ({
  label,
  value,
  isInverse,
  loading,
  numBetsLoaded,
  classes,
}) => {
  // flip the sign if isInverse is true
  const isPositive = value !== undefined && value > 0 !== isInverse;
  const isNegative = value !== undefined && value < 0 !== isInverse;

  const formatValue = (value: number | undefined) => {
    if (value === undefined) {
      if (!loading) return "M—";
      if (numBetsLoaded === undefined || numBetsLoaded < 3000) return "M...";

      return `${numBetsLoaded.toLocaleString()} bets loaded...`;
    }
    return `M${parseInt(value.toFixed(0)).toLocaleString()}`;
  };

  const formattedValue = formatValue(value);

  return (
    <div className={classes.detailsRow}>
      <span>{label}:</span>
      <span
        className={classNames(classes.value, {
          [classes.green]: isPositive,
          [classes.red]: isNegative,
        })}
      >
        {formattedValue}
      </span>
    </div>
  );
};

interface UserSectionProps {
  usernameInput?: string;
  setUsernameInput: React.Dispatch<React.SetStateAction<string | undefined>>;
  authedUsername?: string;
  userModel?: UserModel;
  setUserModel: React.Dispatch<React.SetStateAction<UserModel | undefined>>;
  refetchCounter: number;
}

const parseUsername = (usernameInput: string | undefined): string =>
  usernameInput?.split("/").pop()?.replace("@", "") || "";

const UserSection: React.FC<UserSectionProps> = ({
  usernameInput,
  setUsernameInput,
  authedUsername,
  userModel,
  setUserModel,
  refetchCounter,
}: UserSectionProps) => {
  const classes = useStyles();
  const { pushError, clearError } = useErrors();

  const [foundUser, setFoundUser] = useState<boolean>(false);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [numBetsLoaded, setNumBetsLoaded] = useState<number>(0);
  const usernameInputRef = useRef<string | undefined>(usernameInput);

  const loadedUsers = useRef<Record<string, User>>({});
  const loadedUserModels = useRef<Record<string, UserModel>>({});

  const refetchCounterRef = React.useRef(refetchCounter);

  const updateDisplayUsers = useCallback(() => {
    const username = parseUsername(usernameInputRef.current);

    const _user = loadedUsers.current[username];
    const _userModel = loadedUserModels.current[username];
    if (_user && _user !== user) {
      setUser(_user);
      setFoundUser(true);
      setUserModel(_userModel);
    } else if (_userModel) {
      setUserModel(_userModel);
    }
  }, [setUserModel, user]);

  // Fetch the user
  useEffect(() => {
    usernameInputRef.current = usernameInput;
    if (!usernameInput || usernameInput.length == 0) return;
    if (
      usernameInput === user?.username &&
      refetchCounterRef.current === refetchCounter
    ) {
      setFoundUser(true);
      return;
    }
    refetchCounterRef.current = refetchCounter;

    const parsedUsername = parseUsername(usernameInput);

    const tryFetchUser = async (username: string) => {
      logger.debug("Fetching user", username);
      const _user = await fetchUser(username);

      if (!_user) return;
      loadedUsers.current[username] = _user;
      updateDisplayUsers();

      logger.debug("Building user model", username);
      const _userModel = await buildUserModel(
        _user,
        pushError,
        clearError,
        setNumBetsLoaded
      );
      if (!_userModel) return;

      loadedUserModels.current[username] = _userModel;
      updateDisplayUsers();
    };
    void tryFetchUser(parsedUsername);
  }, [
    usernameInput,
    refetchCounter,
    authedUsername,
    user?.username,
    userModel?.user.username,
    updateDisplayUsers,
    pushError,
    clearError,
  ]);

  useEffect(() => {
    if (!authedUsername || !user) return;

    if (authedUsername && user.username !== authedUsername) {
      pushError({
        key: "wrongUser",
        message: `"${user.username}" is not the user associated with the API key, which is "${authedUsername}". If you place a bet you will be betting as "${authedUsername}".`,
        severity: "warning",
      });
    }
    if (authedUsername && user.username === authedUsername) {
      clearError("wrongUser");
    }
  }, [authedUsername, pushError, clearError, user]);

  const userInputStatus = foundUser
    ? "success"
    : usernameInput
    ? "error"
    : undefined;

  const { name = "—", avatarUrl = "https://manifold.markets/logo.svg" } =
    user || {};

  const displayBalance = userModel?.balance ?? user?.balance;
  const displayPortfolioEV =
    userModel?.portfolioEV ??
    // profit = portfolioEV - totalDeposits => portfolioEV = profit + totalDeposits
    (user?.profitCached?.allTime ?? 0) + (user?.totalDeposits ?? 0);
  const displayLoans = userModel?.loans;

  return (
    <>
      <div className={classes.inputSection}>
        <InputField
          label={<strong>User</strong>}
          id="usernameInput"
          type="text"
          placeholder='e.g "jack" or "https://manifold.markets/jack"'
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          status={userInputStatus}
          className={classes.inputField}
        />
      </div>
      <div className={classes.profileContainer}>
        <img
          src={avatarUrl}
          alt="User avatar"
          className={classes.avatar}
          width="80"
          height="80"
        />
        <div className={classes.detailsContainer}>
          <div className={classes.detailsTitle}>{name}</div>
          <Detail
            label="Balance"
            value={displayBalance}
            classes={classes}
            loading={false}
          />
          <Detail
            label="Total loans"
            value={displayLoans}
            isInverse
            classes={classes}
            loading={!!user && !userModel}
            numBetsLoaded={numBetsLoaded}
          />
          <Detail
            label="Portfolio value"
            value={displayPortfolioEV}
            classes={classes}
            loading={false}
          />
        </div>
      </div>
    </>
  );
};

export default UserSection;
