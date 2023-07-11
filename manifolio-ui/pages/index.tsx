import { InputField } from "@/components/InputField";
import { BetRecommendationFull, getBetRecommendation } from "@/lib/calculate";
import { CpmmMarketModel, buildCpmmMarketModel } from "@/lib/market";
import { UserModel, buildUserModel, getAuthedUsername } from "@/lib/user";
import logger from "@/logger";
import { Theme } from "@/styles/theme";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { createUseStyles } from "react-jss";

const COLUMN_MAX_WIDTH = "640px";

const useStyles = createUseStyles((theme: Theme) => ({
  main: {
    minHeight: "100vh",
    backgroundColor: theme.background,
  },
  centralColumn: {
    margin: "auto",
    maxWidth: COLUMN_MAX_WIDTH,
    padding: "48px 24px",
    width: "fit-content",
    [theme.breakpoints.sm]: {
      padding: "36px 24px",
    },
  },
  calculatorRow: {
    marginBottom: "16px",
    "& input": {
      marginLeft: 8,
    },
  },
}));

export default function Home() {
  const classes = useStyles();

  /* User inputs */
  // TODO these will eventually have autocomplete, they should be their own components
  const [apiKeyInput, setApiKeyInput] = useState<string>();
  const [usernameInput, setUsernameInput] = useState<string>("WilliamHoward");
  const [marketInput, setMarketInput] = useState<string>(
    "will-i-decide-that-there-is-a-bette"
  );

  const [foundApiKey, setFoundApiKey] = useState<boolean>(false);
  const [foundUser, setFoundUser] = useState<boolean>(false);
  const [foundMarket, setFoundMarket] = useState<boolean>(false);

  const [probabilityInput, setProbabilityInput] = useState(0.5);
  const [deferenceFactor, setDeferenceFactor] = useState(0.5);

  const [marketModel, setMarketModel] = useState<CpmmMarketModel | undefined>(
    undefined
  );
  const [userModel, setUserModel] = useState<UserModel | undefined>(undefined);
  const [betRecommendation, setBetRecommendation] = useState<
    BetRecommendationFull | undefined
  >(undefined);

  const marketProb = marketModel?.market.probability;

  useEffect(() => {
    const tryCalculate = async () => {
      if (!marketModel || !userModel) return;

      const kellyWithPortfolioOptimalBet = userModel
        ? await getBetRecommendation({
            estimatedProb: probabilityInput,
            deferenceFactor,
            marketModel,
            userModel,
          })
        : undefined;

      setBetRecommendation(kellyWithPortfolioOptimalBet);
    };
    void tryCalculate();
  }, [deferenceFactor, marketModel, probabilityInput, userModel]);

  // Fetch the authenticated user
  useEffect(() => {
    if (!apiKeyInput || apiKeyInput.length == 0) return;

    const tryFetchUser = async (apiKey: string) => {
      const authedUsername = await getAuthedUsername(apiKey);

      if (!authedUsername) return;

      setFoundApiKey(true);
      setUsernameInput(authedUsername);
    };
    void tryFetchUser(apiKeyInput);
  }, [apiKeyInput]);

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
  }, [usernameInput]);

  // Fetch the market
  useEffect(() => {
    if (!marketInput || marketInput.length == 0) return;
    const parsedSlug = marketInput.split("/").pop() || "";

    const tryFetchMarket = async (slug: string) => {
      const marketModel = await buildCpmmMarketModel(slug);

      // If e.g. the slug is not valid, don't update anything
      if (!marketModel) {
        setFoundMarket(false);
        return;
      }

      // vague attempt to stop race conditions
      if (slug !== parsedSlug) return;

      setFoundMarket(true);
      setMarketModel(marketModel);
    };
    void tryFetchMarket(parsedSlug);
  }, [marketInput]);

  const placeBet = useCallback(async () => {
    if (!betRecommendation || !marketModel?.market.id) return;

    const { amount, outcome } = betRecommendation;

    const res = await fetch("/api/bet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 1,
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
      <Head>
        <title>Manifolio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@__Will_Howard__" />
        <meta name="twitter:title" content="Manifolio" />
        <meta
          name="twitter:image"
          content="https://manifold.markets/logo-white.png"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={classes.main}>
        <div className={classes.centralColumn}>
          <InputField
            label="API key (required only for placing bets):"
            id="apiKeyInput"
            type="text"
            placeholder='Find in "Edit Profile" on Manifold'
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            status={
              apiKeyInput !== undefined && apiKeyInput.length > 0
                ? foundApiKey
                  ? "success"
                  : "error"
                : undefined
            }
          />
          <InputField
            label="Manifold username or url:"
            id="usernameInput"
            type="text"
            placeholder="e.g. @WilliamHoward or https://manifold.markets/WilliamHoward"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            status={foundUser ? "success" : "error"}
            disabled={!!apiKeyInput && apiKeyInput.length > 0}
          />
          {userModel && (
            <div>
              <p>Balance: {userModel.balance.toFixed(0)}</p>
              <p>Total loans: {userModel.loans.toFixed(0)}</p>
              <p>
                Balance net of loans: {userModel.balanceAfterLoans.toFixed(0)}
              </p>
              <p>Portfolio value: {userModel.portfolioEV.toFixed(0)}</p>
            </div>
          )}
          <InputField
            label="Market slug or url:"
            id="marketInput"
            type="text"
            placeholder="e.g. will-scott-alexander-blog-about-sil or https://manifold.markets/xyz/will-scott-alexander-blog-about-sil"
            value={marketInput}
            onChange={(e) => setMarketInput(e.target.value)}
            status={foundMarket ? "success" : "error"}
          />
          {marketProb !== undefined && (
            <div>
              <p>Market probability: {(marketProb * 100).toFixed(1)}%</p>
            </div>
          )}
          <br />
          <InputField
            label="True probability estimate (%):"
            id="probabilityInput"
            type="number"
            step="1"
            min="0"
            max="100"
            value={probabilityInput * 100}
            onChange={(e) =>
              setProbabilityInput(parseFloat(e.target.value) / 100)
            }
          />
          <InputField
            label="Deference factor (lower is more risk averse):"
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
            Optimal bet accounting for variation in value of illiquid
            investments:
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
                  {((betRecommendation.dailyTotalRoi - 1) * 100).toPrecision(3)}
                  %
                </p>
              </div>
              {/* Place bet */}
              <button disabled={!foundApiKey} onClick={placeBet}>
                Place bet
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
