import CalculatorSection from "@/components/CalculatorSection";
import MarketSection from "@/components/MarketSection";
import UserSection from "@/components/UserSection";
import { useLocalStorageState } from "@/components/hooks/useLocalStorageState";
import { CpmmMarketModel } from "@/lib/market";
import { UserModel } from "@/lib/user";
import { Theme } from "@/styles/theme";
import Head from "next/head";
import { useState } from "react";
import { createUseStyles } from "react-jss";

const COLUMN_MAX_WIDTH = "620px";

const useStyles = createUseStyles((theme: Theme) => ({
  main: {
    minHeight: "100vh",
    backgroundColor: theme.background,
    fontFamily: theme.bodyFont,
  },
  centralColumn: {
    margin: "auto",
    maxWidth: COLUMN_MAX_WIDTH,
    paddingTop: 1,
    width: "100%",
  },
  calculatorWrapper: {
    border: `5px solid ${theme.border.main}`,
    borderRadius: "8px",
    marginTop: "48px",
    padding: "32px 24px",
  },
  hr: {
    marginBottom: 18,
  },
}));

export default function Home() {
  const classes = useStyles();

  const [apiKeyInput, setApiKeyInput] = useLocalStorageState<
    string | undefined
  >("apiKeyInput", undefined);
  const [marketInput, setMarketInput] = useLocalStorageState<
    string | undefined
  >("marketInput", undefined);

  const [foundAuthedUser, setFoundAuthedUser] = useState<boolean>(false);

  const [userModel, setUserModel] = useState<UserModel | undefined>(undefined);
  const [marketModel, setMarketModel] = useState<CpmmMarketModel | undefined>(
    undefined
  );

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
          <div className={classes.calculatorWrapper}>
            <UserSection
              apiKeyInput={apiKeyInput}
              setApiKeyInput={setApiKeyInput}
              foundAuthedUser={foundAuthedUser}
              setFoundAuthedUser={setFoundAuthedUser}
              userModel={userModel}
              setUserModel={setUserModel}
            />
            <hr className={classes.hr} />
            <MarketSection
              marketInput={marketInput}
              setMarketInput={setMarketInput}
              marketModel={marketModel}
              setMarketModel={setMarketModel}
            />
            <hr className={classes.hr} />
            <CalculatorSection
              apiKeyInput={apiKeyInput}
              userModel={userModel}
              marketModel={marketModel}
              foundAuthedUser={foundAuthedUser}
            />
          </div>
        </div>
      </main>
    </>
  );
}
