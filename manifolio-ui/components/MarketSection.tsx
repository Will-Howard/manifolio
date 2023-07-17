import { useCallback, useEffect, useState } from "react";
import {
  CpmmMarketModel,
  buildCpmmMarketModel,
  fetchMarket,
} from "@/lib/market";
import { InputField } from "@/components/InputField";
import { createUseStyles } from "react-jss";
import { FullMarket } from "@/lib/vendor/manifold-sdk";
import { Classes } from "jss";
import { useErrors } from "./hooks/useErrors";

const useStyles = createUseStyles(() => ({
  inputSection: {
    display: "flex",
    flexDirection: "row",
  },
  inputField: {
    flex: 1,
    maxWidth: 403,
  },
  profileContainer: {
    display: "flex",
  },
  avatar: {
    borderRadius: "50%",
    margin: "8px 24px 8px 4px",
    objectFit: "cover",
  },
  detailsTitle: {
    fontWeight: 600,
    margin: "4px 0",
  },
  detailsContainer: {
    display: "flex",
    flexDirection: "column",
    maxWidth: 290,
    width: "100%",
  },
  detailsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  value: {
    fontWeight: 600,
  },
}));

function getSlug(input: string | undefined): string {
  if (!input) return "";

  try {
    // Create a new URL object with the input. If the input is a valid URL, this will succeed.
    const url = new URL(input);
    // The pathname property will be something like "/Austin/will-lightcone-repay-their-300k-loa"
    const pathnameParts = url.pathname.split("/");
    // The slug is the last part of the pathname
    return pathnameParts[pathnameParts.length - 1];
  } catch (err) {
    // If creating a new URL object fails, the input is not a valid URL
    return input;
  }
}

interface DetailProps {
  label: string;
  value: string;
  isInverse?: boolean;
  classes: Classes;
}

const Detail: React.FC<DetailProps> = ({ label, value, classes }) => {
  return (
    <div className={classes.detailsRow}>
      <span>{label}:</span>
      <span className={classes.value}>{value}</span>
    </div>
  );
};

interface MarketSectionProps {
  marketInput: string | undefined;
  setMarketInput: React.Dispatch<React.SetStateAction<string | undefined>>;
  marketModel: CpmmMarketModel | undefined;
  setMarketModel: React.Dispatch<
    React.SetStateAction<CpmmMarketModel | undefined>
  >;
}

const MarketSection: React.FC<MarketSectionProps> = ({
  marketInput,
  setMarketInput,
  setMarketModel,
}) => {
  const classes = useStyles();
  const { pushError, clearError } = useErrors();

  const [market, setMarket] = useState<FullMarket | undefined>(undefined);
  const [foundMarket, setFoundMarket] = useState<boolean>(false);

  const errorCheck = useCallback((market: FullMarket): boolean => {
    let error = false;
    if (market.closeTime === undefined || market.closeTime < Date.now()) {
      pushError({
        key: "marketClosed",
        code: "MARKET_CLOSED",
        message: "This market has closed.",
        severity: "error",
      });
      error = true;
    } else {
      clearError("marketClosed");
    }

    if (market.mechanism !== "cpmm-1") {
      pushError({
        key: "marketNotCpmm",
        code: "MARKET_NOT_CPMM",
        message: "Only CPMM markets are suported.",
        severity: "error",
      });
      error = true;
    } else {
      clearError("marketNotCpmm");
    }

    return error;
  }, []);

  useEffect(() => {
    console.log("marketInput", marketInput);
    if (!marketInput || marketInput.length === 0) return;
    const parsedSlug = getSlug(marketInput);

    const tryFetchMarket = async (slug: string) => {
      const market = await fetchMarket(slug);
      setFoundMarket(!!market);

      if (!market) return;
      setMarket(market);

      if (errorCheck(market)) return;

      // slow
      const marketModel = await buildCpmmMarketModel(market);
      setMarketModel(marketModel);
    };
    void tryFetchMarket(parsedSlug);
  }, [marketInput, setMarketModel]);

  const inputStatus = marketInput
    ? foundMarket
      ? "success"
      : "error"
    : undefined;

  const {
    question = "—",
    probability = undefined,
    creatorAvatarUrl = "https://manifold.markets/logo.svg",
  } = market || {};

  // TODO truncate question around 2 lines on mobile

  return (
    <>
      <div className={classes.inputSection}>
        <InputField
          label={<strong>Market</strong>}
          id="marketInput"
          type="text"
          placeholder="Url or slug"
          value={marketInput}
          onChange={(e) => setMarketInput(e.target.value)}
          status={inputStatus}
          className={classes.inputField}
        />
      </div>
      <div className={classes.profileContainer}>
        <img
          src={creatorAvatarUrl}
          alt="Market creator avatar"
          className={classes.avatar}
          width="80"
          height="80"
        />
        <div className={classes.detailsContainer}>
          <div className={classes.detailsTitle}>{question}</div>
          <Detail
            label="Market probability"
            value={
              probability === undefined
                ? "—"
                : `${(probability * 100).toFixed(1)}%`
            }
            classes={classes}
          />
          {/* TODO expected time to close */}
          {/* TODO your position */}
        </div>
      </div>
    </>
  );
};

export default MarketSection;
