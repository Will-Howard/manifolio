import { InputField } from "@/components/InputField";
import {
  BetRecommendation,
  calculateFullKellyBet,
  calculateFullKellyBetGeneric,
  calculateNaiveKellyBet,
  getEffectiveProbability,
} from "@/lib/calculate";
import { getManifoldApi } from "@/lib/manifold-api";
import { getMarketProb } from "@/lib/market-utils";
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
  const [kellyFractionInput, setKellyFractionInput] = useState(0.5);

  const [marketProb, setMarketProb] = useState(0.5);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [kellyBet, setKellyBet] = useState<BetRecommendation>({
    amount: 0,
    outcome: "YES",
  });
  const [kellyBetGeneric, setKellyBetGeneric] = useState<BetRecommendation>({
    amount: 0,
    outcome: "YES",
  });

  useEffect(() => {
    if (!marketInput || marketInput.length == 0) return;

    const fetchMarketProb = async (slug: string) => {
      const marketProb = await getMarketProb(slug);
      const fullKellyBet = await calculateFullKellyBet({
        estimatedProb: probabilityInput,
        deferenceFactor: kellyFractionInput,
        marketSlug: slug,
        bankroll: user?.balance ?? 1000,
      });
      const fullKellyBetGeneric = await calculateFullKellyBetGeneric({
        estimatedProb: probabilityInput,
        deferenceFactor: kellyFractionInput,
        marketSlug: slug,
        bankroll: user?.balance ?? 1000,
      });
      if (slug !== marketInput || !marketProb) return; // vague attempt to stop race conditions

      setKellyBet(fullKellyBet);
      setKellyBetGeneric(fullKellyBetGeneric);
      setMarketProb(marketProb);
    };
    fetchMarketProb(marketInput);
  }, [kellyFractionInput, marketInput, probabilityInput, user]);

  // Get the user
  useEffect(() => {
    if (!usernameInput || usernameInput.length == 0) return;

    const fetchUser = async (username: string) => {
      try {
        const fetchedUser = await getManifoldApi().getUser({ username });
        setUser(fetchedUser);
      } catch (e) {
        console.error(e);
        return;
      }
    };
    fetchUser(usernameInput);
  }, [usernameInput]);

  const bankroll = user?.balance ?? 1000;
  const { amount: naiveKellyBet, outcome: naiveKellyOutcome } =
    calculateNaiveKellyBet({
      marketProb: marketProb,
      estimatedProb: probabilityInput,
      deferenceFactor: kellyFractionInput,
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
          <InputField
            label="Market slug or url:"
            id="marketInput"
            type="text"
            placeholder="e.g. will-scott-alexander-blog-about-sil or https://manifold.markets/xyz/will-scott-alexander-blog-about-sil"
            value={marketInput}
            onChange={(e) => setMarketInput(e.target.value)}
          />
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
            label="Kelly fraction:"
            id="kellyFractionInput"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={kellyFractionInput}
            onChange={(e) => setKellyFractionInput(parseFloat(e.target.value))}
          />
          <div>
            <p>RESULTS</p>
          </div>
          <div>
            <p>
              Outcome:{" "}
              {naiveKellyOutcome === kellyBet.outcome
                ? naiveKellyOutcome
                : "ERROR"}
            </p>
          </div>
          <InputField
            label="Naive Kelly bet:"
            id="naiveKellyBet"
            type="number"
            readOnly
            value={naiveKellyBet}
            decimalPlaces={0}
            onChange={() => {}}
          />
          <InputField
            label="Full kelly bet:"
            id="kellyBet"
            type="number"
            step="0.01"
            readOnly
            value={kellyBet.amount}
            decimalPlaces={0}
            onChange={() => {}}
          />
          <div>
            <p>Shares: {kellyBet.shares}</p>
          </div>
          <div>
            <p>
              Implied market probability:{" "}
              {getEffectiveProbability({
                outcomeShares: kellyBet.shares,
                betAmount: kellyBet.amount,
                outcome: kellyBet.outcome,
              })}
            </p>
          </div>
          <div>
            <p>New probability: {kellyBet.pAfter}</p>
          </div>
          <InputField
            label="Full kelly bet (generic):"
            id="kellyBet"
            type="number"
            step="0.01"
            readOnly
            value={kellyBetGeneric.amount}
            decimalPlaces={0}
            onChange={() => {}}
          />
          <div>
            <p>Shares (generic): {kellyBetGeneric.shares}</p>
          </div>
          <div>
            <p>
              Implied market probability (generic):{" "}
              {getEffectiveProbability({
                outcomeShares: kellyBetGeneric.shares,
                betAmount: kellyBetGeneric.amount,
                outcome: kellyBetGeneric.outcome,
              })}
            </p>
          </div>
          <div>
            <p>New probability (generic): {kellyBetGeneric.pAfter}</p>
          </div>
          {/* DEBUG SECTION */}
          <div>
            <p>DEBUG</p>
          </div>
          <div>
            <p>Market prob: {marketProb}</p>
          </div>
          <div>
            <p>Bankroll: {bankroll}</p>
          </div>
        </div>
      </main>
    </>
  );
}
