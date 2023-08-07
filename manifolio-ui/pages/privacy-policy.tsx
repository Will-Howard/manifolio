import { ErrorProvider } from "@/components/hooks/useErrors";
import { Theme, petrona } from "@/styles/theme";
import classNames from "classnames";
import Head from "next/head";
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
    padding: "1px 16px 16px 16px",
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

export default function PrivacyPolicy() {
  const classes = useStyles();

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
            <h2>Privacy Policy for Manifolio</h2>

            <h3>1. Introduction</h3>
            <p>
              Manifolio, operated by an individual ("I", "me", or "my"),
              provides this Privacy Policy to inform you of the collection, use,
              and disclosure of personal information when using my website. This
              Privacy Policy may be updated periodically, and by continuing to
              use the website after such updates, you consent to the revised
              policy.
            </p>

            <h3>2. Information Collection and Use</h3>
            <p>
              <strong>Personal Information</strong> is data that can be used to
              identify you, such as your Manifold username.
            </p>
            <ul>
              <li>
                <strong>What I Collect:</strong> When you interact with the
                website, I and/or third party service providers may gather your
                Manifold username and bet amounts for analytics purposes, as
                well as other non-identifying information. Your Manifold API key
                is exclusively stored in your browser&apos;s local storage and
                never retained on my servers or handled by third party services
                (except Manifold).
              </li>
              <li>
                <strong>How I Use Your Information:</strong> For analytics, to
                understand user behavior. To use your API key to facilitate
                bets.
              </li>
            </ul>

            <h3>3. Information Sharing and Disclosure</h3>
            <p>
              This Privacy Policy does not apply to third-party websites or
              services, even if they link to Manifolio. Be sure to review the
              privacy policies of any third-party sites you visit.
            </p>

            <h3>4. Contact</h3>
            <p>
              For questions or concerns about this Privacy Policy, reach out to
              me via{" "}
              <a
                href="mailto:w.howard256+manifolio@gmail.com"
                target="_blank"
                rel="noopener"
              >
                email
              </a>
              .
            </p>

            <p>
              <strong>Privacy Policy Last Updated:</strong> 2023-08-07
            </p>
          </div>
        </main>
      </ErrorProvider>
    </>
  );
}
