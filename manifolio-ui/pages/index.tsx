import { InputField } from "@/components/InputField";
import {
  BetRecommendationFull,
  calculateFullKellyBet,
  calculateNaiveKellyBet,
} from "@/lib/calculate";
import { getManifoldApi } from "@/lib/manifold-api";
import { getMarket } from "@/lib/market-utils";
import { User } from "@/lib/vendor/manifold-sdk";
import Head from "next/head";
import { useEffect, useState } from "react";
import { createUseStyles } from "react-jss";

const COLUMN_MAX_WIDTH = "640px";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStyles = createUseStyles((theme: any) => ({
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
  const [usernameInput, setUsernameInput] = useState("WilliamHoward");
  const [marketInput, setMarketInput] = useState(
    "will-i-decide-that-there-is-a-bette"
  );
  const [probabilityInput, setProbabilityInput] = useState(0.5);
  const [deferenceFactor, setDeferenceFactor] = useState(0.5);
  const [useBalance, setUseBalance] = useState(false);

  const [marketProb, setMarketProb] = useState<number | undefined>(undefined);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [kellyBet, setKellyBet] = useState<BetRecommendationFull>({
    amount: 0,
    outcome: "YES",
    shares: 0,
    pAfter: 0.5,
  });

  const balance = user?.balance ?? 1000;
  const portfolioValue =
    (user?.profitCached?.allTime ?? 0) + (user?.totalDeposits ?? 0);

  const bankroll = useBalance ? balance : portfolioValue;

  useEffect(() => {
    if (!marketInput || marketInput.length == 0) return;
    const parsedSlug = marketInput.split("/").pop() || "";

    const fetchMarketProb = async (slug: string) => {
      const market = await getMarket({ slug });
      const marketProb = (await market.getMarket())?.probability;
      const fullKellyBetGeneric = await calculateFullKellyBet({
        estimatedProb: probabilityInput,
        deferenceFactor,
        marketSlug: slug,
        bankroll,
      });
      // vague attempt to stop race conditions
      if (slug !== parsedSlug || !marketProb) return;

      setKellyBet(fullKellyBetGeneric);
      setMarketProb(marketProb);
    };
    fetchMarketProb(parsedSlug);
  }, [bankroll, deferenceFactor, marketInput, probabilityInput, user]);

  // Get the user
  useEffect(() => {
    if (!usernameInput || usernameInput.length == 0) return;
    const parsedUsername = usernameInput.split("/").pop() || "";

    const fetchUser = async (username: string) => {
      try {
        const fetchedUser = await getManifoldApi().getUser({ username });
        setUser(fetchedUser);
      } catch (e) {
        console.error(e);
        return;
      }
    };
    fetchUser(parsedUsername);
  }, [usernameInput]);

  const { amount: naiveKellyBet, outcome: naiveKellyOutcome } =
    calculateNaiveKellyBet({
      marketProb: marketProb ?? probabilityInput,
      estimatedProb: probabilityInput,
      deferenceFactor: deferenceFactor,
      bankroll,
    });

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
            label="Manifold username or url:"
            id="usernameInput"
            type="text"
            placeholder="e.g. @WilliamHoward or https://manifold.markets/WilliamHoward"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          {balance !== undefined && portfolioValue !== undefined && (
            <div className={classes.calculatorRow}>
              <div>
                <input
                  type="radio"
                  id="balance"
                  checked={useBalance}
                  onClick={() => setUseBalance(true)}
                />
                <label htmlFor="balance">Balance: {balance.toFixed(0)}</label>
              </div>
              <div>
                <input
                  type="radio"
                  id="portfolioValue"
                  checked={!useBalance}
                  onClick={() => setUseBalance(false)}
                />
                <label htmlFor="portfolioValue">
                  Portfolio value: {portfolioValue.toFixed(0)}
                </label>
              </div>
            </div>
          )}
          {bankroll !== undefined && (
            <div>
              <p>Bankroll: {bankroll.toFixed(0)}</p>
            </div>
          )}
          <InputField
            label="Market slug or url:"
            id="marketInput"
            type="text"
            placeholder="e.g. will-scott-alexander-blog-about-sil or https://manifold.markets/xyz/will-scott-alexander-blog-about-sil"
            value={marketInput}
            onChange={(e) => setMarketInput(e.target.value)}
          />
          {marketProb !== undefined && (
            <div>
              <p>Market probability: {(marketProb * 100).toFixed(1)}%</p>
            </div>
          )}
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
          {naiveKellyOutcome !== kellyBet.outcome && (
            <div>
              <p>ERROR</p>
            </div>
          )}
          <div>
            <p>
              Kelly optimal bet: M{kellyBet.amount.toFixed(0)} on{" "}
              {kellyBet.outcome}
            </p>
          </div>
          <div>
            <p>
              {kellyBet.outcome} Shares: {kellyBet.shares.toFixed(0)}
            </p>
          </div>
          <div>
            <p>Probability after bet: {(kellyBet.pAfter * 100).toFixed(1)}%</p>
          </div>
        </div>
      </main>
    </>
  );
}
