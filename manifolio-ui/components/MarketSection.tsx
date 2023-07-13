import { useEffect, useMemo } from "react";
import { CpmmMarketModel, buildCpmmMarketModel } from "@/lib/market";
import { InputField } from "@/components/InputField";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles(() => ({
  inputSection: {
    display: "flex",
    flexDirection: "row",
    width: "50%",
  },
  inputField: {
    flex: 1,
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
  marketModel,
  setMarketModel,
}) => {
  const classes = useStyles();

  useEffect(() => {
    if (!marketInput || marketInput.length === 0) return;
    const parsedSlug = getSlug(marketInput);

    const tryFetchMarket = async (slug: string) => {
      const marketModel = await buildCpmmMarketModel(slug);

      // If e.g. the slug is not valid, don't update anything
      if (!marketModel) {
        return;
      }

      // vague attempt to stop race conditions
      if (slug !== parsedSlug) return;

      setMarketModel(marketModel);
    };
    void tryFetchMarket(parsedSlug);
  }, [marketInput, setMarketModel]);

  const marketMatchesInput = useMemo(
    () =>
      marketModel?.market.url &&
      getSlug(marketModel.market.url) === getSlug(marketInput),
    [marketInput, marketModel?.market.url]
  );

  const inputStatus = marketMatchesInput ? "success" : "error";

  return (
    <>
      <div className={classes.inputSection}>
        <InputField
          label="Market"
          id="marketInput"
          type="text"
          placeholder="Url or slug. E.g. will-scott-alexander-blog-about-sil or https://manifold.markets/xyz/will-scott-alexander-blog-about-sil"
          value={marketInput}
          onChange={(e) => setMarketInput(e.target.value)}
          status={inputStatus}
          className={classes.inputField}
        />
      </div>
      {marketModel?.market.probability !== undefined && (
        <div>
          <p>
            Market probability:{" "}
            {(marketModel?.market.probability * 100).toFixed(1)}%
          </p>
        </div>
      )}
    </>
  );
};

export default MarketSection;
