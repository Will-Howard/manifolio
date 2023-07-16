import { useState, useEffect, useCallback } from "react";
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
  betAmountInput: {
    marginTop: 8,
  },
  executeBetRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
  },
  apiKeyInput: {
    // Eyeballed to be the same as the amount input on full width
    maxWidth: 388,
  },
  placeBetButton: {
    margin: "10px 0 8px 10px !important",
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
  userModel: UserModel | undefined;
  marketModel: CpmmMarketModel | undefined;
  foundAuthedUser: boolean;
}

const CalculatorSection: React.FC<CalculatorSectionProps> = ({
  apiKeyInput,
  userModel,
  marketModel,
  foundAuthedUser,
}) => {
  const classes = useStyles();

  const [probabilityInput, setProbabilityInput] = useLocalStorageState(
    "probabilityInput",
    50
  );
  const [deferenceFactor, setDeferenceFactor] = useLocalStorageState(
    "deferenceFactor",
    0.5
  );
  const [betRecommendation, setBetRecommendation] = useState<
    BetRecommendationFull | undefined
  >(undefined);

  const [editableAmount, setEditableAmount] = useState<number | undefined>();
  const [editableOutcome, setEditableOutcome] = useState<Outcome>();

  const marketProb = marketModel?.market.probability;
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
      1 - deferenceFactor
    );
  }, [
    deferenceFactor,
    marketModel,
    probabilityInput,
    userModel,
    getBetRecommendationThrottled,
    estimatedProb,
  ]);

  const placeBet = useCallback(async () => {
    if (!betRecommendation || !marketModel?.market.id) return;

    const { amount, outcome } = betRecommendation;
    const body = {
      amount,
      marketId: marketModel.market.id,
      outcome,
      apiKey: apiKeyInput,
    };
    logger.debug("placeBet body:", body);

    // const res = await fetch("/api/bet", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(body),
    // });
    // logger.info("Created bet:", res);
  }, [apiKeyInput, betRecommendation, marketModel?.market.id]);

  const naiveKellyOutcome =
    estimatedProb > (marketProb ?? estimatedProb) ? "YES" : "NO";
  // TODO add error codes to betRecommendation and handle them here

  const betAmount =
    editableAmount ??
    (betRecommendation?.amount ? Math.round(betRecommendation.amount) : 0);
  const betOutcome =
    editableOutcome ??
    (betRecommendation?.outcome ? betRecommendation?.outcome : "YES");

  // TODO calculate bet outcomes for non-recommendation amount

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
          label="Safety factor"
          id="kellyFractionInput"
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={deferenceFactor}
          onChange={(e) => setDeferenceFactor(parseFloat(e.target.value))}
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
          <InputField
            id="amountInput"
            type="number"
            step="1"
            min="0"
            value={betAmount}
            onChange={(e) =>
              setEditableAmount(Math.round(parseFloat(e.target.value)))
            }
            className={classNames(classes.inputField, classes.betAmountInput)}
          />
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
        {/* TODO handle custom amount */}
        {betRecommendation && (
          <div className={classes.detailsContainer}>
            <Detail
              label={`Payout if ${
                editableOutcome || betRecommendation.outcome
              }`}
              value={`M${betRecommendation.shares.toFixed(0)}`}
              classes={classes}
            />
            <Detail
              label="New probability"
              // TODO handle negative case, plus pull out this logic
              value={`${(betRecommendation.pAfter * 100).toFixed(1)}% (+${(
                (betRecommendation.pAfter -
                  (marketModel?.market.probability ?? 0)) *
                100
              ).toFixed(1)}%)`}
              classes={classes}
            />
          </div>
        )}
        <div className={classes.executeBetRow}>
          <InputField
            label="API key"
            id="probabilityInput"
            type="number"
            value={probabilityInput}
            onChange={(e) => setProbabilityInput(parseFloat(e.target.value))}
            className={classNames(classes.inputField, classes.apiKeyInput)}
          />
          <Button
            variant={"contained"}
            disabled={!foundAuthedUser}
            className={classes.placeBetButton}
            onClick={placeBet}
          >
            Place bet
          </Button>
          {/* TODO warnings and errors here */}
        </div>
      </div>
    </>
  );
};

export default CalculatorSection;
