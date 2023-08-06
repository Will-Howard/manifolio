import { useCallback, useEffect, useMemo, useState } from "react";
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
import { UserModel } from "@/lib/user";
import { Theme } from "@/styles/theme";
import classNames from "classnames";
import moment from "moment";
import logger from "@/logger";
import { formatInt } from "@/lib/utils";

const useStyles = createUseStyles((theme: Theme) => ({
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
    // truncate to 2 lines using -webkit-line-clamp
    display: "-webkit-box",
    "-webkit-line-clamp": 2,
    "-webkit-box-orient": "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
  red: {
    color: theme.red,
  },
  green: {
    color: theme.green,
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
  value: string | JSX.Element;
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
  userModel?: UserModel;
  refetchCounter: number;
}

const MarketSection: React.FC<MarketSectionProps> = ({
  marketInput,
  setMarketInput,
  marketModel,
  setMarketModel,
  userModel,
  refetchCounter,
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
        message: "This market has closed.",
        severity: "error",
      });
      error = true;
    } else {
      clearError("marketClosed");
    }

    if (market.mechanism !== "cpmm-1" || market.outcomeType !== "BINARY") {
      pushError({
        key: "marketNotCpmm",
        message: "Only YES/NO markets are supported.",
        severity: "error",
      });
      error = true;
    } else {
      clearError("marketNotCpmm");
    }

    return error;
  }, []);

  useEffect(() => {
    if (!marketInput || marketInput.length === 0) return;
    const parsedSlug = getSlug(marketInput);

    const tryFetchMarket = async (slug: string) => {
      logger.debug(`Fetching market ${slug}`);
      const market = await fetchMarket(slug);
      setFoundMarket(!!market);

      if (!market) return;
      setMarket(market);

      if (errorCheck(market)) return;

      logger.debug(`Building market model for ${slug}`);
      const marketModel = await buildCpmmMarketModel(market);
      setMarketModel(marketModel);
    };
    void tryFetchMarket(parsedSlug);
  }, [marketInput, setMarketModel, refetchCounter, errorCheck]);

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

  // User's position
  const marketId = market?.id;
  const userPosition: JSX.Element | string = (() => {
    const position =
      marketId && userModel?.positions.find((p) => p.contractId === marketId);

    if (!position) return "—";
    const outcome = position.outcome;

    return (
      <span>
        {formatInt(position.payout)}{" "}
        <span
          className={classNames({
            [classes.red]: outcome === "NO",
            [classes.green]: outcome === "YES",
          })}
        >
          {outcome}
        </span>{" "}
        shares
      </span>
    );
  })();

  const marketEndTime = market?.closeTime;
  const marketEndTimeString = useMemo(
    () => (marketEndTime ? moment(marketEndTime).fromNow(true) : "—"),
    [marketEndTime]
  );

  return (
    <>
      <div className={classes.inputSection}>
        <InputField
          label={<strong>Market</strong>}
          id="marketInput"
          type="text"
          placeholder='e.g. "https://manifold.markets/jskf/will-alexbgoode"'
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
          <Detail
            label="Your position"
            value={userPosition}
            classes={classes}
          />
          <Detail
            label="Est. time to resolution"
            value={marketEndTimeString}
            classes={classes}
          />
        </div>
      </div>
    </>
  );
};

export default MarketSection;
