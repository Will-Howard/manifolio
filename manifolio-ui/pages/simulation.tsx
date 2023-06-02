import { Theme } from "@/styles/theme";
import Head from "next/head";
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
}));

export default function Home() {
  const classes = useStyles();

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
        <div className={classes.centralColumn}>Hello world</div>
      </main>
    </>
  );
}
