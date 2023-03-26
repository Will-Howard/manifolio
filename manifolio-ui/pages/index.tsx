import { getBinaryCpmmBetInfoWrapper, getMarketProb } from "@/lib/market-utils";
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

function calculateKellyBet(/* add required parameters here */) {
  // Add your calculation logic here
  return 0; // Replace with the actual calculated value
}

function calculateNaiveKellyFraction({
  marketProb,
  estimatedProb,
  kellyFraction,
}: {
  marketProb: number;
  estimatedProb: number;
  kellyFraction: number;
}) {
  // kellyFraction * ((p - p_market) / (1 - p_market))
  const naiveKelly =
    kellyFraction * ((estimatedProb - marketProb) / (1 - marketProb));
  // clamp between 0 and 1
  return Math.min(Math.max(naiveKelly, 0), 1);
}

export default function Home() {
  const classes = useStyles();
  /* User inputs */
  const [manifoldInput, setManifoldInput] = useState("");
  const [marketInput, setMarketInput] = useState("");
  const [probabilityInput, setProbabilityInput] = useState(0);
  const [kellyFractionInput, setKellyFractionInput] = useState(0.5);

  const [marketProb, setMarketProb] = useState(0);

  useEffect(() => {
    if (!marketInput || marketInput.length > 0) {
      const fetchMarketProb = async (slug: string) => {
        const marketProb = await getMarketProb(slug);
        const res = await getBinaryCpmmBetInfoWrapper("YES", 100, slug);
        console.log(res);
        if (slug !== marketInput || !marketProb) return; // vague attempt to stop race conditions

        setMarketProb(marketProb);
      };
      fetchMarketProb(marketInput);
    }
  }, [marketInput]);

  // const kellyBet = calculateKellyBet(/* pass required parameters here */);
  // const naiveKellyBet = calculateNaiveKellyBet(/* pass required parameters here */);
  const [kellyBet, setKellyBet] = useState(0);
  const naiveKellyBet = calculateNaiveKellyFraction({
    marketProb: marketProb,
    estimatedProb: probabilityInput,
    kellyFraction: kellyFractionInput,
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
          <div className={classes.calculatorRow}>
            <label htmlFor="manifoldInput">Manifold username or url:</label>
            <input
              id="manifoldInput"
              type="text"
              placeholder="e.g. @WilliamHoward or https://manifold.markets/WilliamHoward"
              value={manifoldInput}
              onChange={(e) => setManifoldInput(e.target.value)}
            />
          </div>
          <div className={classes.calculatorRow}>
            <label htmlFor="marketInput">Market slug or url:</label>
            <input
              id="marketInput"
              type="text"
              placeholder="e.g. will-scott-alexander-blog-about-sil or https://manifold.markets/xyz/will-scott-alexander-blog-about-sil"
              value={marketInput}
              onChange={(e) => setMarketInput(e.target.value)}
            />
          </div>
          <div className={classes.calculatorRow}>
            <label htmlFor="probabilityInput">
              True probability estimate (%):
            </label>
            <input
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
          </div>
          <div className={classes.calculatorRow}>
            <label htmlFor="kellyFractionInput">Kelly fraction:</label>
            <input
              id="kellyFractionInput"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={kellyFractionInput}
              onChange={(e) =>
                setKellyFractionInput(parseFloat(e.target.value))
              }
            />
          </div>
          <div className={classes.calculatorRow}>
            <label htmlFor="kellyBet">Kelly bet:</label>
            <input
              id="kellyBet"
              type="number"
              step="0.01"
              readOnly
              value={kellyBet}
            />
          </div>
          <div className={classes.calculatorRow}>
            <label htmlFor="naiveKellyBet">Naive Kelly bet:</label>
            <input
              id="naiveKellyBet"
              type="number"
              step="0.01"
              readOnly
              value={naiveKellyBet}
            />
          </div>
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
