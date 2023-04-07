import { InputField } from "@/components/InputField";
import { getManifoldApi } from "@/lib/manifold-api";
import { getBinaryCpmmBetInfoWrapper, getMarketProb } from "@/lib/market-utils";
import { User } from "@/lib/vendor/manifold-sdk";
import Head from "next/head";
import { useEffect, useState } from "react";
import { createUseStyles } from "react-jss";

const COLUMN_MAX_WIDTH = "640px";

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

function calculateNaiveKellyFraction({
  marketProb,
  estimatedProb,
  deferenceFactor,
}: {
  marketProb: number;
  estimatedProb: number;
  deferenceFactor: number;
}) {
  // kellyFraction * ((p - p_market) / (1 - p_market))
  const naiveKelly =
    deferenceFactor * ((estimatedProb - marketProb) / (1 - marketProb));

  // clamp between 0 and 1
  return Math.min(Math.max(naiveKelly, 0), 1);
}

async function calculateFullKellyBet({
  estimatedProb,
  deferenceFactor,
  marketSlug,
  user,
}: {
  estimatedProb: number;
  deferenceFactor: number;
  marketSlug: string;
  user: User;
}) {
  const startingMarketProb = await getMarketProb(marketSlug);
  if (!startingMarketProb) {
    console.log("Could not get market prob");
    return 0;
  }
  const betYes = estimatedProb > startingMarketProb;
  const naiveKellyFraction = calculateNaiveKellyFraction({
    marketProb: startingMarketProb,
    estimatedProb,
    deferenceFactor,
  });
  const naiveKellyBet = naiveKellyFraction * user.balance;

  let lowerBound = 0;
  let upperBound = naiveKellyBet;
  const iterations = 10;

  for (let i = 0; i < iterations; i++) {
    const betEstimate = (lowerBound + upperBound) / 2;
    const newShares = await getBinaryCpmmBetInfoWrapper(
      "YES",
      betEstimate,
      marketSlug
    );
    if (!newShares) {
      console.log("Could not get new shares");
      break;
    }

    const effectiveProb = betEstimate / newShares;

    const newKellyBet =
      user.balance *
      calculateNaiveKellyFraction({
        marketProb: effectiveProb,
        estimatedProb,
        deferenceFactor,
      });

    if (newKellyBet > betEstimate) {
      lowerBound = betEstimate;
    } else {
      upperBound = betEstimate;
    }
  }

  // At the end of the binary search iterations, the optimal amount to bet is the average of lowerBound and upperBound.
  const optimalAmountToBet = (lowerBound + upperBound) / 2;

  return optimalAmountToBet;
}

export default function Home() {
  const classes = useStyles();
  /* User inputs */
  const [usernameInput, setUsernameInput] = useState("WilliamHoward");
  const [marketInput, setMarketInput] = useState(
    "will-i-decide-that-there-is-a-bette"
  );
  const [probabilityInput, setProbabilityInput] = useState(0);
  const [kellyFractionInput, setKellyFractionInput] = useState(0.5);

  const [marketProb, setMarketProb] = useState(0);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [kellyBet, setKellyBet] = useState(0);

  useEffect(() => {
    if (!marketInput || marketInput.length == 0) return;

    const fetchMarketProb = async (slug: string) => {
      const marketProb = await getMarketProb(slug);
      const fullKellyBet = await calculateFullKellyBet({
        estimatedProb: probabilityInput,
        deferenceFactor: kellyFractionInput,
        marketSlug: slug,
        user: user!,
      });
      if (slug !== marketInput || !marketProb) return; // vague attempt to stop race conditions

      setKellyBet(fullKellyBet);
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

  const naiveKellyBet =
    (user?.balance ?? 1) *
    calculateNaiveKellyFraction({
      marketProb: marketProb,
      estimatedProb: probabilityInput,
      deferenceFactor: kellyFractionInput,
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
          <InputField
            label="Naive Kelly bet:"
            id="naiveKellyBet"
            type="number"
            step="0.01"
            readOnly
            value={naiveKellyBet}
            onChange={(e) => {}}
          />
          <InputField
            label="Full kelly bet:"
            id="kellyBet"
            type="number"
            step="0.01"
            readOnly
            value={kellyBet}
            onChange={(e) => {}}
          />
          {/* DEBUG SECTION */}
          <div>
            <p>DEBUG</p>
          </div>
          <div>
            <p>Market prob: {marketProb}</p>
          </div>
        </div>
      </main>
    </>
  );
}
