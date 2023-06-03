import { InputField } from "@/components/InputField";
import { BetRecommendationFull, calculateFullKellyBet } from "@/lib/calculate";
import { fetchMarketCached } from "@/lib/market-utils";
import { fetchUser } from "@/lib/user-utils";
import { User } from "@/lib/vendor/manifold-sdk";
import { Theme } from "@/styles/theme";
import Head from "next/head";
import { useEffect, useState } from "react";
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

const FALLBACK_BALANCE = 1000;

export default function Home() {
  const classes = useStyles();

  /* User inputs */
  // TODO these will eventually have autocomplete, they should be their own components
  const [usernameInput, setUsernameInput] = useState<string>("WilliamHoward");
  const [marketInput, setMarketInput] = useState<string>(
    "will-i-decide-that-there-is-a-bette"
  );

  const [foundUser, setFoundUser] = useState<boolean>(false);
  const [foundMarket, setFoundMarket] = useState<boolean>(false);

  const [probabilityInput, setProbabilityInput] = useState(0.5);
  const [deferenceFactor, setDeferenceFactor] = useState(0.5);
  const [useBalance, setUseBalance] = useState(false);

  const [marketProb, setMarketProb] = useState<number | undefined>(undefined);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [kellyBet, setKellyBet] = useState<BetRecommendationFull | undefined>(
    undefined
  );

  const balance = user?.balance ?? FALLBACK_BALANCE;
  const portfolioValue =
    (user?.profitCached?.allTime ?? 0) + (user?.totalDeposits ?? 0);

  const bankroll = useBalance ? balance : portfolioValue;

  // TODO hide more of this handling in the lib code
  useEffect(() => {
    if (!marketInput || marketInput.length == 0) return;
    const parsedSlug = marketInput.split("/").pop() || "";

    const tryFetchMarket = async (slug: string) => {
      const market = await fetchMarketCached({ slug });
      const marketProb = (await market.getMarket())?.probability;

      // If e.g. the slug is not valid, don't update anything
      if (!marketProb) {
        setFoundMarket(false);
        return;
      }

      const kellyOptimalBet = await calculateFullKellyBet({
        estimatedProb: probabilityInput,
        deferenceFactor,
        marketSlug: slug,
        bankroll,
      });
      // vague attempt to stop race conditions
      if (slug !== parsedSlug || !marketProb) return;

      setFoundMarket(true);
      setKellyBet(kellyOptimalBet);
      setMarketProb(marketProb);
    };
    void tryFetchMarket(parsedSlug);
  }, [bankroll, deferenceFactor, marketInput, probabilityInput, user]);

  // Get the user
  useEffect(() => {
    if (!usernameInput || usernameInput.length == 0) return;
    const parsedUsername = usernameInput.split("/").pop() || "";

    const tryFetchUser = async (username: string) => {
      const fetchedUser = await fetchUser(username);
      if (!fetchedUser) {
        setFoundUser(false);
        return;
      }

      setFoundUser(true);
      setUser(fetchedUser);
    };
    tryFetchUser(parsedUsername);
  }, [usernameInput]);

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
            label="Manifold username or url:"
            id="usernameInput"
            type="text"
            placeholder="e.g. @WilliamHoward or https://manifold.markets/WilliamHoward"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            status={foundUser ? "success" : "error"}
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
          {kellyBet && (
            <>
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
                <p>
                  Probability after bet: {(kellyBet.pAfter * 100).toFixed(1)}%
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
