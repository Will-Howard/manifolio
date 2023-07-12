// components/MarketSection.tsx

import { useState, useEffect } from "react";
import { CpmmMarketModel, buildCpmmMarketModel } from "@/lib/market";
import { InputField } from "@/components/InputField";

interface MarketSectionProps {
  marketInput: string;
  setMarketInput: React.Dispatch<React.SetStateAction<string>>;
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
  const [foundMarket, setFoundMarket] = useState<boolean>(false);

  useEffect(() => {
    if (!marketInput || marketInput.length === 0) return;
    const parsedSlug = marketInput.split("/").pop() || "";

    const tryFetchMarket = async (slug: string) => {
      const marketModel = await buildCpmmMarketModel(slug);

      // If e.g. the slug is not valid, don't update anything
      if (!marketModel) {
        setFoundMarket(false);
        return;
      }

      // vague attempt to stop race conditions
      if (slug !== parsedSlug) return;

      setFoundMarket(true);
      setMarketModel(marketModel);
    };
    void tryFetchMarket(parsedSlug);
  }, [marketInput, setMarketModel]);

  return (
    <>
      <InputField
        label="Market:"
        id="marketInput"
        type="text"
        placeholder="Slug or url. E.g. will-scott-alexander-blog-about-sil or https://manifold.markets/xyz/will-scott-alexander-blog-about-sil"
        value={marketInput}
        onChange={(e) => setMarketInput(e.target.value)}
        status={foundMarket ? "success" : "error"}
      />
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
