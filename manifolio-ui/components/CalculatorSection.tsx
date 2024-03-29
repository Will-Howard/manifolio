import { useState, useEffect } from "react";
import { UserModel } from "@/lib/user";
import { InputField } from "@/components/InputField";
import { BetRecommendationFull, getBetRecommendation } from "@/lib/calculate";
import logger from "@/logger";
import { createUseStyles } from "react-jss";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { Classes } from "jss";
import { Theme } from "@/styles/theme";
import { useErrors } from "./hooks/useErrors";
import { CpmmMarketModel } from "@/lib/market";
import PlaceBetSection from "./PlaceBetSection";
import classNames from "classnames";
import useThrottle from "./hooks/useThrottle";
import { formatRoi } from "@/lib/utils";

const useStyles = createUseStyles((theme: Theme) => ({
  inputSection: {
    display: "flex",
    flexDirection: "row",
    gap: "3%",
  },
  inputField: {
    flex: 1,
    maxWidth: 403,
  },
  detailsContainer: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    marginTop: 12,
    marginBottom: 16,
    [theme.breakpoints.sm]: {
      marginTop: 8,
    },
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
  advancedOptions: {
    minHeight: 125,
  },
  advancedOptionsToggle: {
    fontWeight: 600,
    cursor: "pointer",
    width: "fit-content",
    marginBottom: 8,
    userSelect: "none",
  },
  arrow: {
    display: "inline-block",
    fontSize: "0.7rem",
    marginRight: 2,
  },
  arrowOpen: {
    transform: "rotate(90deg)",
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
  authedUsername: string | undefined;
  setAuthedUsername: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUsernameInput: React.Dispatch<React.SetStateAction<string | undefined>>;
  userModel: UserModel | undefined;
  marketModel: CpmmMarketModel | undefined;
  setRefetchCounter: React.Dispatch<React.SetStateAction<number>>;
}

const CalculatorSection: React.FC<CalculatorSectionProps> = ({
  authedUsername,
  setAuthedUsername,
  setUsernameInput,
  userModel,
  marketModel,
  setRefetchCounter,
}) => {
  const classes = useStyles();
  const { pushError, clearError } = useErrors();

  const [probabilityInput, setProbabilityInput] = useLocalStorageState(
    "probability",
    50
  );
  const [deferralFactor, setDeferralFactor] = useLocalStorageState<number>(
    "deferralFactor",
    50
  );
  const [overdraft, setOverdraft] = useLocalStorageState<number>(
    "overdraft",
    0
  );
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useLocalStorageState<boolean>("showAdvancedOptions", false);

  const [betRecommendation, setBetRecommendation] = useState<
    BetRecommendationFull | undefined
  >(undefined);

  const estimatedProb = probabilityInput / 100;

  const getBetRecommendationThrottled = useThrottle(
    (
      marketModel: CpmmMarketModel,
      userModel: UserModel,
      estimatedProb: number,
      deferenceFactor: number,
      overdraft: number
    ) => {
      const kellyWithPortfolioOptimalBet = getBetRecommendation({
        estimatedProb,
        deferenceFactor,
        overdraft,
        marketModel,
        userModel,
        pushError,
        clearError,
      });

      setBetRecommendation(kellyWithPortfolioOptimalBet);
    },
    500, // throttle delay
    { leading: true, trailing: true }
  );

  useEffect(() => {
    if (!marketModel || !userModel) return;

    getBetRecommendationThrottled(
      marketModel,
      userModel,
      estimatedProb,
      isNaN(deferralFactor) ? 0 : deferralFactor / 100,
      isNaN(overdraft) ? 0 : overdraft
    );
  }, [
    deferralFactor,
    marketModel,
    probabilityInput,
    userModel,
    getBetRecommendationThrottled,
    estimatedProb,
    overdraft,
  ]);

  const formatBetRecommendation = (
    betRecommendation?: BetRecommendationFull
  ) => {
    if (!betRecommendation) return "—";

    return (
      <>
        <strong>
          M{parseInt(betRecommendation.amount.toFixed(0)).toLocaleString()}
        </strong>{" "}
        on{" "}
        <span
          className={
            betRecommendation.outcome === "YES" ? classes.green : classes.red
          }
        >
          <strong>{betRecommendation.outcome}</strong>
        </span>
      </>
    );
  };

  return (
    <>
      <div className={classes.inputSection}>
        <InputField
          label={<strong>Probability estimate (%)</strong>}
          id="probabilityInput"
          type="number"
          step="1"
          min="0"
          max="100"
          value={probabilityInput}
          onChange={(e) => setProbabilityInput(parseFloat(e.target.value))}
          className={classes.inputField}
        />
      </div>
      {/* Results section */}
      <div className={classes.detailsContainer}>
        <Detail
          label={<strong>Recommended bet</strong>}
          value={formatBetRecommendation(betRecommendation)}
          classes={classes}
        />
        <Detail
          label="Expected return of this bet on it's own"
          value={formatRoi(betRecommendation?.annualRoi)}
          classes={classes}
        />
        <Detail
          label="Expected growth in entire portfolio due to this bet"
          value={formatRoi(betRecommendation?.annualTotalRoi)}
          classes={classes}
        />
      </div>
      <PlaceBetSection
        authedUsername={authedUsername}
        setAuthedUsername={setAuthedUsername}
        setUsernameInput={setUsernameInput}
        marketModel={marketModel}
        betRecommendation={betRecommendation}
        setRefetchCounter={setRefetchCounter}
      />
      <div className={classes.advancedOptions}>
        <div
          className={classes.advancedOptionsToggle}
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
        >
          <span
            className={classNames(classes.arrow, {
              [classes.arrowOpen]: showAdvancedOptions,
            })}
          >
            ▶
          </span>{" "}
          Advanced options
        </div>
        {showAdvancedOptions && (
          <>
            <InputField
              label="Deferral factor (%)"
              subtitle={
                <>
                  A lower value means you are deferring to the market more, so
                  taking less risk. This is equivalent to{" "}
                  <a
                    href="https://www.lesswrong.com/posts/TNWnK9g2EeRnQA8Dg/never-go-full-kelly"
                    target="_blank"
                    rel="noopener"
                  >
                    &quot;fractional Kelly betting&quot;
                  </a>
                </>
              }
              id="deferralFactorInput"
              type="number"
              step="1"
              min="0"
              max="100"
              value={deferralFactor}
              onChange={(e) => setDeferralFactor(parseFloat(e.target.value))}
              className={classes.inputField}
            />
            <InputField
              label="Mana overdraft"
              subtitle="How negative you are willing to let your balance go in the worst case scenario"
              id="overdraftInput"
              type="number"
              step="1"
              min="0"
              value={overdraft}
              onChange={(e) => setOverdraft(parseFloat(e.target.value))}
              className={classes.inputField}
            />
          </>
        )}
      </div>
    </>
  );
};

export default CalculatorSection;
