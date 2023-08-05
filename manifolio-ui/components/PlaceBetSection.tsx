import { useState, useEffect, useCallback, useMemo } from "react";
import { InputField } from "@/components/InputField";
import { BetRecommendationFull, Outcome } from "@/lib/calculate";
import logger from "@/logger";
import { createUseStyles } from "react-jss";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { Button } from "@mui/material";
import { Classes } from "jss";
import { Theme, theme } from "@/styles/theme";
import classNames from "classnames";
import { formatInt } from "@/lib/utils";
import { ManifolioError, useErrors } from "./hooks/useErrors";
import ErrorMessage from "./ErrorMessage";
import { CpmmMarketModel } from "@/lib/market";

const useStyles = createUseStyles((theme: Theme) => ({
  inputField: {
    flex: 1,
  },
  detailsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 4,
  },
  label: {
    maxWidth: "65%", // To stop the label and value from getting too close
  },
  value: {
    marginTop: "auto",
    fontWeight: 600,
  },
  red: {
    color: theme.red,
  },
  green: {
    color: theme.green,
  },
  yesButton: {
    backgroundColor: `${theme.green} !important`,
    color: `${theme.green} !important`,
  },
  placeBetSection: {
    border: `2px solid`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  betInputSection: {
    display: "flex",
    flexDirection: "row",
    gap: "3%",
    alignItems: "center",
  },
  betAmountInputWrapper: {
    display: "flex",
    flexDirection: "row",
    gap: "4px",
    alignItems: "center",
    width: "100%",
    minWidth: 100,
  },
  betAmountInput: {
    marginTop: 8,
    minWidth: 100,
  },
  executeBetRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
  },
  apiKeyInput: {
    // Eyeballed to be the same as the amount input on full width
    maxWidth: 385,
  },
  placeBetButton: {
    margin: "10px 0 8px 10px !important",
  },
  betOutcomesContainer: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    marginTop: 8,
  },
  useRecommendation: {
    fontStyle: "italic",
    fontWeight: 600,
    marginTop: -4,
    color: "#6c6c6c",
    cursor: "pointer",
    fontSize: 15,
    width: "fit-content",
  },
}));

interface DetailProps {
  label: JSX.Element | string;
  value: JSX.Element | string;
  isInverse?: boolean;
  classes: Classes;
}

const Detail: React.FC<DetailProps> = ({ label, value, classes }) => {
  return (
    <div className={classes.detailsRow}>
      <span className={classes.label}>{label}:</span>
      <span className={typeof value === "string" ? classes.value : ""}>
        {value}
      </span>
    </div>
  );
};

interface PlaceBetSectionProps {
  authedUsername: string | undefined;
  setAuthedUsername: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUsernameInput: React.Dispatch<React.SetStateAction<string | undefined>>;
  marketModel: CpmmMarketModel | undefined;
  betRecommendation: BetRecommendationFull | undefined;
  setRefetchCounter: React.Dispatch<React.SetStateAction<number>>;
}

const PlaceBetSection: React.FC<PlaceBetSectionProps> = ({
  authedUsername,
  setAuthedUsername,
  setUsernameInput,
  marketModel,
  betRecommendation,
  setRefetchCounter,
}) => {
  const classes = useStyles();
  const { errors } = useErrors();

  const hasErrors = errors.some(
    (error: ManifolioError) => error.severity === "error"
  );

  const [editableAmount, setEditableAmount] = useState<
    // null is interpreted as "they are using the editable amount, but have cleared the input"
    number | undefined | null
  >();
  const [editableOutcome, setEditableOutcome] = useState<Outcome>();

  const [apiKeyInput, setApiKeyInput] = useLocalStorageState<
    string | undefined
  >("apiKeyInput", undefined);

  const resetEditableFields = useCallback(() => {
    setEditableAmount(undefined);
    setEditableOutcome(undefined);
  }, []);

  const [recentlyBet, setRecentlyBet] = useState<boolean>(false);

  const authedUsernameFound = !!authedUsername;
  // Fetch the authenticated user
  useEffect(() => {
    if (!apiKeyInput || apiKeyInput.length == 0) {
      if (authedUsernameFound) setAuthedUsername(undefined);
      return;
    }

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

      if (!authedUsername) {
        setAuthedUsername(undefined);
        return;
      }

      logger.info("Fetched authenticated user:", authedUsername);
      setAuthedUsername(authedUsername);
      setUsernameInput(authedUsername);
    };
    void tryFetchUser(apiKeyInput);

    // FIXME setUsernameInput causes rerender if added as a dependency. This is likely a bug in useLocalStorageState
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyInput]);

  const apiKeyInputStatus = authedUsernameFound
    ? "success"
    : apiKeyInput
    ? "error"
    : undefined;

  const betAmount =
    editableAmount ?? // use the editable amount if it's set to a number
    // otherwise use the bet recommendation amount, UNLESS editableAmount is null
    // which means the user has backspaced the input to be empty (so use 0)
    (editableAmount !== null && betRecommendation?.amount
      ? Math.round(betRecommendation.amount)
      : 0);
  const betAmountDisplay = editableAmount !== null ? betAmount : "";

  const betOutcome =
    editableOutcome ??
    (betRecommendation?.outcome ? betRecommendation?.outcome : "YES");

  const { newShares: betShares, probAfter: betProbAfter } = useMemo(
    () =>
      marketModel?.getBetInfo(betOutcome, betAmount) ?? {
        newShares: undefined,
        probAfter: 0,
      },
    [betAmount, betOutcome, marketModel]
  );

  const betProbChange =
    (betProbAfter ?? 0) - (marketModel?.market.probability ?? 0);

  const placeBet = useCallback(async () => {
    if (!betAmount || !marketModel?.market.id || !betOutcome) return;
    setRecentlyBet(true);

    const body = {
      amount: Math.round(betAmount),
      marketId: marketModel.market.id,
      outcome: betOutcome,
      apiKey: apiKeyInput,
    };

    const res = await fetch("/api/bet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const createdBet = await res.json();
    logger.info("Created bet:", createdBet);

    // Wait for the bet to be processed. TODO don't rely on this
    await new Promise((resolve) => setTimeout(resolve, 500));

    setRefetchCounter((prev) => prev + 1);
    setRecentlyBet(false);
  }, [
    apiKeyInput,
    betAmount,
    betOutcome,
    marketModel?.market?.id,
    setRefetchCounter,
  ]);

  return (
    <div className={classes.placeBetSection}>
      <div className={classes.betInputSection}>
        <div className={classes.betAmountInputWrapper}>
          <span>
            <strong>M</strong>
          </span>
          <InputField
            id="amountInput"
            type="number"
            step="1"
            min="0"
            value={betAmountDisplay}
            onChange={(e) => {
              setEditableAmount(
                e.target.value ? Math.round(parseFloat(e.target.value)) : null
              );
            }}
            className={classNames(classes.inputField, classes.betAmountInput)}
          />
        </div>
        <span> on </span>
        <Button
          variant={betOutcome === "YES" ? "contained" : "outlined"}
          style={{
            // TODO use proper theme here (see https://stackoverflow.com/questions/46486565/material-ui-customize-button-color)
            backgroundColor: betOutcome === "YES" ? theme.green : undefined,
            borderColor: theme.green,
            color: betOutcome === "YES" ? "white" : "black",
          }}
          onClick={() => setEditableOutcome("YES")}
        >
          YES
        </Button>
        <Button
          variant={betOutcome === "NO" ? "contained" : "outlined"}
          style={{
            // TODO use proper theme here (see https://stackoverflow.com/questions/46486565/material-ui-customize-button-color)
            backgroundColor: betOutcome === "NO" ? theme.red : undefined,
            borderColor: theme.red,
            color: betOutcome === "NO" ? "white" : "black",
          }}
          onClick={() => setEditableOutcome("NO")}
        >
          NO
        </Button>
      </div>
      <div className={classes.useRecommendation} onClick={resetEditableFields}>
        {editableAmount !== undefined || editableOutcome !== undefined
          ? "use recommendation"
          : "\u00A0"}
      </div>
      <div className={classes.betOutcomesContainer}>
        <Detail
          label={`Payout if ${betOutcome}`}
          value={`M${formatInt(betShares)}`}
          classes={classes}
        />
        <Detail
          label="New probability"
          value={`${(betProbAfter * 100).toFixed(1)}% (${
            betProbChange >= 0 ? "+" : "-"
          }${(Math.abs(betProbChange) * 100).toFixed(1)}%)`}
          classes={classes}
        />
      </div>
      <div className={classes.executeBetRow}>
        <InputField
          label="API key"
          id="apiKeyInput"
          placeholder='Find in "Edit Profile" on Manifold'
          status={apiKeyInputStatus}
          type="text"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          className={classNames(classes.inputField, classes.apiKeyInput)}
        />
        <Button
          variant={"contained"}
          disabled={!authedUsername || hasErrors || recentlyBet}
          className={classes.placeBetButton}
          onClick={placeBet}
        >
          Place bet
        </Button>
      </div>
      {errors.length > 0 && (
        <div>
          {errors.map((error: ManifolioError, idx: number) => (
            <ErrorMessage key={`error_${idx}`} error={error} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaceBetSection;
