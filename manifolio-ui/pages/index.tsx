import CalculatorSection from "@/components/CalculatorSection";
import MarketSection from "@/components/MarketSection";
import UserSection from "@/components/UserSection";
import { ErrorProvider } from "@/components/hooks/useErrors";
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
    padding: "0 16px 48px 16px",
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
  >("username", undefined);
  const [marketInput, setMarketInput] = useLocalStorageState<
    string | undefined
  >("market", undefined);

  const [userModel, setUserModel] = useState<UserModel | undefined>(undefined);
  const [marketModel, setMarketModel] = useState<CpmmMarketModel | undefined>(
    undefined
  );
  const [authedUsername, setAuthedUsername] = useState<string | undefined>(
    undefined
  );

  const [refetchCounter, setRefetchCounter] = useState(0);

  const title = "Manifolio";
  const description = "Bet size calculator for Manifold Markets";
  const cardImage = "https://manifol.io/book.png";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />

        {/* General tags */}
        <meta name="description" content={description} />
        <meta name="image" content={cardImage} />

        {/* OpenGraph tags */}
        <meta property="og:url" content="https://manifol.io/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={cardImage} />
        <meta property="og:type" content="website" />

        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@__Will_Howard__" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={cardImage} />

        <link rel="icon" href="/book.svg" />
      </Head>
      <ErrorProvider>
        <main className={classes.main}>
          <div className={classNames(classes.centralColumn, petrona.className)}>
            <h1 className={classes.title}>Manifolio</h1>
            <p className={classes.subtitle}>
              Bet size calculator for{" "}
              <a
                href="https://manifold.markets/"
                target="_blank"
                rel="noopener"
              >
                Manifold
              </a>
              , read the docs{" "}
              <a
                href="https://github.com/Will-Howard/manifolio/"
                target="_blank"
                rel="noopener"
              >
                here
              </a>
            </p>
            <div className={classes.headerBorder} />
            <UserSection
              usernameInput={usernameInput}
              setUsernameInput={setUsernameInput}
              authedUsername={authedUsername}
              userModel={userModel}
              setUserModel={setUserModel}
              refetchCounter={refetchCounter}
            />
            <hr className={classes.hr} />
            <MarketSection
              marketInput={marketInput}
              setMarketInput={setMarketInput}
              marketModel={marketModel}
              setMarketModel={setMarketModel}
              userModel={userModel}
              refetchCounter={refetchCounter}
            />
            <hr className={classes.hr} />
            <CalculatorSection
              authedUsername={authedUsername}
              setAuthedUsername={setAuthedUsername}
              setUsernameInput={setUsernameInput}
              userModel={userModel}
              marketModel={marketModel}
              setRefetchCounter={setRefetchCounter}
            />
          </div>
        </main>
      </ErrorProvider>
    </>
  );
}
