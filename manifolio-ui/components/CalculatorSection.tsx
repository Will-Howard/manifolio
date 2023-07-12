import { useState, useEffect, useCallback } from "react";
import { UserModel } from "@/lib/user";
import { CpmmMarketModel } from "@/lib/market";
import { InputField } from "@/components/InputField";
import { BetRecommendationFull, getBetRecommendation } from "@/lib/calculate";
import logger from "@/logger";
import { throttle } from "lodash";

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
  const [probabilityInput, setProbabilityInput] = useState(50);
  const [deferenceFactor, setDeferenceFactor] = useState(0.5);
  const [betRecommendation, setBetRecommendation] = useState<
    BetRecommendationFull | undefined
  >(undefined);

  const marketProb = marketModel?.market.probability;

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
      probabilityInput / 100,
      1 - deferenceFactor
    );
  }, [
    deferenceFactor,
    marketModel,
    probabilityInput,
    userModel,
    getBetRecommendationThrottled,
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
    probabilityInput > (marketProb ?? probabilityInput) ? "YES" : "NO";

  return (
    <>
      <InputField
        label="Probability estimate (%):"
        id="probabilityInput"
        type="number"
        step="1"
        min="0"
        max="100"
        value={probabilityInput}
        onChange={(e) => setProbabilityInput(parseFloat(e.target.value))}
      />
      <InputField
        label="Safety factor:"
        id="kellyFractionInput"
        type="number"
        step="0.01"
        min="0"
        max="1"
        value={deferenceFactor}
        onChange={(e) => setDeferenceFactor(parseFloat(e.target.value))}
      />
      <br />
      {/* Results section */}
      <div>
        Optimal bet accounting for variation in value of illiquid investments:
      </div>
      {betRecommendation && (
        <>
          {naiveKellyOutcome !== betRecommendation.outcome && (
            <div>
              <p>ERROR</p>
            </div>
          )}
          <div>
            <p>
              Kelly optimal bet: M{betRecommendation.amount.toFixed(0)} on{" "}
              {betRecommendation.outcome}
            </p>
          </div>
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
          <div>
            <p>
              ROI from a portfolio of similar independent bets (annual):{" "}
              {((betRecommendation.dailyRoi - 1) * 100).toPrecision(3)}%
            </p>
          </div>
          <div>
            <p>
              ROI if this were your only bet (annual):{" "}
              {((betRecommendation.dailyTotalRoi - 1) * 100).toPrecision(3)}%
            </p>
          </div>
          {/* Place bet */}
          <button disabled={!foundAuthedUser} onClick={placeBet}>
            Place bet
          </button>
        </>
      )}
    </>
  );
};

export default CalculatorSection;
