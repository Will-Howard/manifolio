import { useState, useEffect, useCallback } from "react";
import { UserModel } from "@/lib/user";
import { CpmmMarketModel } from "@/lib/market";
import { InputField } from "@/components/InputField";
import { BetRecommendationFull, getBetRecommendation } from "@/lib/calculate";
import logger from "@/logger";
import { throttle } from "lodash";
import { createUseStyles } from "react-jss";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { Button } from "@mui/material";
import { Classes } from "jss";
import { Theme } from "@/styles/theme";

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

    const res = await fetch("/api/bet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        marketId: marketModel.market.id,
        outcome,
        apiKey: apiKeyInput,
      }),
    });
    logger.info("Created bet:", res);
  }, [apiKeyInput, betRecommendation, marketModel?.market.id]);

  const naiveKellyOutcome =
    estimatedProb > (marketProb ?? estimatedProb) ? "YES" : "NO";
  // TODO add error codes to betRecommendation and handle them here

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
      {betRecommendation && (
        <>
          {/* Place bet */}
          <Button disabled={!foundAuthedUser} onClick={placeBet}>
            Place bet
          </Button>
          <div>
            <p>
              {betRecommendation.outcome} Shares:{" "}
              {betRecommendation.shares.toFixed(0)}
            </p>
          </div>
          <div>
            <p>
              Probability after bet:{" "}
              {(betRecommendation.pAfter * 100).toFixed(1)}%
            </p>
          </div>
        </>
      )}
    </>
  );
};

export default CalculatorSection;
