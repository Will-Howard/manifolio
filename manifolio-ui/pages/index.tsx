import CalculatorSection from "@/components/CalculatorSection";
import MarketSection from "@/components/MarketSection";
import UserSection from "@/components/UserSection";
import { useLocalStorageState } from "@/components/hooks/useLocalStorageState";
import { CpmmMarketModel } from "@/lib/market";
import { UserModel } from "@/lib/user";
import { Theme, petrona } from "@/styles/theme";
import classNames from "classnames";
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
    padding: "0 16px 16px 16px",
    "& a": {
      textDecoration: "none",
      fontWeight: 600,
      color: theme.link,
      "&:visited": {
        color: theme.link,
      },
    },
  },
  hr: {
    marginBottom: 18,
    marginTop: 12,
  },
  title: {
    padding: "16px 0 0 0",
    margin: 0,
  },
  subtitle: {
    fontStyle: "italic",
    margin: "0 0 4px 0",
  },
  headerBorder: {
    borderBottom: `1px solid black`,
    borderTop: `1px solid black`,
    height: 2,
    marginBottom: 12,
  },
}));

export default function Home() {
  const classes = useStyles();

  const [usernameInput, setUsernameInput] = useLocalStorageState<
    string | undefined
  >("usernameInput", undefined);
  const [marketInput, setMarketInput] = useLocalStorageState<
    string | undefined
  >("marketInput", undefined);
  const [apiKeyInput, setApiKeyInput] = useLocalStorageState<
    string | undefined
  >("apiKeyInput", undefined);

  const [userModel, setUserModel] = useState<UserModel | undefined>(undefined);
  const [marketModel, setMarketModel] = useState<CpmmMarketModel | undefined>(
    undefined
  );

  return (
    <>
      <Head>
        <title>Manifolio</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@__Will_Howard__" />
        <meta name="twitter:title" content="Manifolio" />
        <meta
          name="description"
          content="Bet sizing tool for Manifold Markets"
        />
        {/* TODO does this actually work (because it's a relative link)? */}
        <meta name="twitter:image" content="/book.svg" />
        <link rel="icon" href="/book.svg" />
      </Head>
      <main className={classes.main}>
        <div className={classNames(classes.centralColumn, petrona.className)}>
          <h1 className={classes.title}>Manifolio</h1>
          <p className={classes.subtitle}>
            Bet size calculator for{" "}
            <a href="https://manifold.markets/">Manifold</a>, read the docs{" "}
            {/* TODO */}
            <a href="https://manifold.markets/">here</a>
          </p>
          <div className={classes.headerBorder} />
          <UserSection
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
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
            setApiKeyInput={setApiKeyInput}
            setUsernameInput={setUsernameInput}
            userModel={userModel}
            marketModel={marketModel}
          />
        </div>
      </main>
    </>
  );
}
