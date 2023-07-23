import React, { useEffect, useState } from "react";
import { UserModel, buildUserModel, fetchUser } from "@/lib/user";
import { InputField } from "@/components/InputField";
import { createUseStyles } from "react-jss";
import type { Bet, User } from "@/lib/vendor/manifold-sdk";
import { Classes } from "jss";
import type { Theme } from "@/styles/theme";
import classNames from "classnames";
import { useErrors } from "./hooks/useErrors";

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
  placedBets: Bet[];
}

const UserSection: React.FC<UserSectionProps> = ({
  usernameInput,
  setUsernameInput,
  authedUsername,
  userModel,
  setUserModel,
  refetchCounter,
  placedBets,
}: UserSectionProps) => {
  const classes = useStyles();
  const { pushError, clearError } = useErrors();

  const [foundUser, setFoundUser] = useState<boolean>(false);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [numBetsLoaded, setNumBetsLoaded] = useState<number>(0);

  const refetchCounterRef = React.useRef(refetchCounter);

  // Fetch the user
  useEffect(() => {
    if (
      !usernameInput ||
      usernameInput.length == 0 ||
      (usernameInput === user?.username &&
        usernameInput === userModel?.user?.username &&
        refetchCounterRef.current === refetchCounter)
    )
      return;
    const parsedUsername =
      usernameInput.split("/").pop()?.replace("@", "") || "";

    const tryFetchUser = async (username: string) => {
      const user = await fetchUser(username);
      setFoundUser(!!user);

      if (!user) return;
      setUser(user);
      if (authedUsername && user.username !== authedUsername) {
        pushError({
          key: "wrongUser",
          code: "UNKNOWN_ERROR", // FIXME error codes are turning out to be annoying, maybe remove them and just use the key
          message: `"${username}" is not the user associated with the API key, which is "${authedUsername}". If you place a bet you will be betting as "${authedUsername}", but the recommendation given will be for "${username}".`,
          severity: "warning",
        });
      }
      if (authedUsername && user.username === authedUsername) {
        clearError("wrongUser");
      }
      setUserModel(undefined);

      // slow
      const userModel = await buildUserModel(
        user,
        pushError,
        clearError,
        setNumBetsLoaded,
        placedBets
      );
      // TODO return errors from buildUserModel
      setUserModel(userModel);
      refetchCounterRef.current = refetchCounter;
    };
    void tryFetchUser(parsedUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setUserModel,
    usernameInput,
    refetchCounter,
    authedUsername,
    user?.username,
    userModel?.user?.username,
    placedBets,
  ]);

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
          placeholder="Url or username"
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
