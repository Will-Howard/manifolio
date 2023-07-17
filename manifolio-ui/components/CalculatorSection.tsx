import { useState, useEffect, useCallback, useMemo } from "react";
import { UserModel } from "@/lib/user";
import { CpmmMarketModel } from "@/lib/market";
import { InputField } from "@/components/InputField";
import {
  BetRecommendationFull,
  Outcome,
  getBetRecommendation,
} from "@/lib/calculate";
import logger from "@/logger";
import { throttle } from "lodash";
import { createUseStyles } from "react-jss";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { Button } from "@mui/material";
import { Classes } from "jss";
import { Theme, theme } from "@/styles/theme";
import classNames from "classnames";
import { formatInt } from "@/lib/utils";
import { ManifolioError, useErrors } from "./hooks/useErrors";
import ErrorMessage from "./ErrorMessage";

const useStyles = createUseStyles((theme: Theme) => ({
  inputSection: {
    display: "flex",
    flexDirection: "row",
    gap: "3%",
  },
  inputField: {
    flex: 1,
  },
  detailsContainer: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    marginTop: 16,
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

interface CalculatorSectionProps {
  apiKeyInput: string | undefined;
  setApiKeyInput: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUsernameInput: React.Dispatch<React.SetStateAction<string | undefined>>;
  userModel: UserModel | undefined;
  marketModel: CpmmMarketModel | undefined;
  refetchCounter: number;
  setRefetchCounter: React.Dispatch<React.SetStateAction<number>>;
}

const CalculatorSection: React.FC<CalculatorSectionProps> = ({
  apiKeyInput,
  setApiKeyInput,
  setUsernameInput,
  userModel,
  marketModel,
  refetchCounter,
  setRefetchCounter,
}) => {
  const classes = useStyles();
  const { errors } = useErrors();

  const hasWarnings = errors.some(
    (error: ManifolioError) => error.severity === "warning"
  );
  const hasErrors = errors.some(
    (error: ManifolioError) => error.severity === "error"
  );

  const [probabilityInput, setProbabilityInput] = useLocalStorageState(
    "probabilityInput",
    50
  );
  const [kellyFraction, setKellyFraction] = useLocalStorageState<number>(
    "kellyFraction",
    50
  );

  const [betRecommendation, setBetRecommendation] = useState<
    BetRecommendationFull | undefined
  >(undefined);

  const [editableAmount, setEditableAmount] = useState<
    // null is interpreted as "they are using the editable amount, but have cleared the input"
    number | undefined | null
  >();
  const [editableOutcome, setEditableOutcome] = useState<Outcome>();

  const resetEditableFields = useCallback(() => {
    setEditableAmount(undefined);
    setEditableOutcome(undefined);
  }, []);

  const [authedUsername, setAuthedUsername] = useState<string | undefined>(
    undefined
  );

  const estimatedProb = probabilityInput / 100;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getBetRecommendationThrottled = useCallback(
    throttle(
      (
        marketModel: CpmmMarketModel,
        userModel: UserModel,
        estimatedProb: number,
        deferenceFactor: number
      ) => {
        const kellyWithPortfolioOptimalBet = getBetRecommendation({
          estimatedProb,
          deferenceFactor,
          marketModel,
          userModel,
        });

        setBetRecommendation(kellyWithPortfolioOptimalBet);
      },
      300, // throttle delay
      { leading: true, trailing: true }
    ),
    [] // dependencies of the throttled function
  );

  useEffect(() => {
    if (!marketModel || !userModel) return;

    getBetRecommendationThrottled(
      marketModel,
      userModel,
      estimatedProb,
      kellyFraction / 100
    );
  }, [
    kellyFraction,
    marketModel,
    probabilityInput,
    userModel,
    getBetRecommendationThrottled,
    estimatedProb,
  ]);

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
      }

      logger.info("Fetched authenticated user:", authedUsername);
      setAuthedUsername(authedUsername);
      setUsernameInput(authedUsername);
    };
    void tryFetchUser(apiKeyInput);
    // FIXME setUsernameInput causes rerender if added as a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyInput, authedUsernameFound, refetchCounter]);

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

    const body = {
      amount: Math.round(betAmount),
      marketId: marketModel.market.id,
      outcome: betOutcome,
      apiKey: apiKeyInput,
    };
    logger.debug("placeBet body:", body);

    const res = await fetch("/api/bet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    logger.info("Created bet:", res);

    setRefetchCounter((prev) => prev + 1);
  }, [
    apiKeyInput,
    betAmount,
    betOutcome,
    marketModel?.market.id,
    setRefetchCounter,
  ]);

  return (
    <>
      <div className={classes.inputSection}>
        <InputField
          label="Prob. estimate (%)"
          id="probabilityInput"
          type="number"
          step="1"
          min="0"
          max="100"
          value={probabilityInput}
          onChange={(e) => setProbabilityInput(parseFloat(e.target.value))}
          className={classes.inputField}
        />
        <InputField
          label="Kelly fraction (%)"
          id="kellyFractionInput"
          type="number"
          step="1"
          min="0"
          max="100"
          value={kellyFraction}
          onChange={(e) => setKellyFraction(parseFloat(e.target.value))}
          className={classes.inputField}
        />
      </div>
      {/* Results section */}
      <div className={classes.detailsContainer}>
        <Detail
          label={<strong>Recommended bet</strong>}
          value={
            betRecommendation ? (
              <>
                <strong>
                  M
                  {parseInt(
                    betRecommendation.amount.toFixed(0)
                  ).toLocaleString()}
                </strong>{" "}
                on{" "}
                <span
                  className={
                    betRecommendation.outcome === "YES"
                      ? classes.green
                      : classes.red
                  }
                >
                  <strong>{betRecommendation.outcome}</strong>
                </span>
              </>
            ) : (
              "—"
            )
          }
          classes={classes}
        />
        <Detail
          label="Annual return from a portfolio of similar bets"
          value={
            betRecommendation
              ? `${((betRecommendation.dailyRoi - 1) * 100).toPrecision(3)}%`
              : "—"
          }
          classes={classes}
        />
        <Detail
          label="Annual return if this were your only bet"
          value={
            betRecommendation
              ? `${((betRecommendation.dailyTotalRoi - 1) * 100).toPrecision(
                  3
                )}%`
              : "—"
          }
          classes={classes}
        />
      </div>
      <br />
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
        <div
          className={classes.useRecommendation}
          onClick={resetEditableFields}
        >
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
            // TODO handle negative case, plus pull out this logic
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
            disabled={!authedUsername || hasErrors}
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
    </>
  );
};

export default CalculatorSection;
