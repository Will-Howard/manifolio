import { Dictionary, groupBy } from "lodash";
import { getManifoldApi } from "./manifold-api";
import type { PositionModel as PositionModel } from "./probability";
import type { Bet, User } from "./vendor/manifold-sdk";

const actualMarketSlugs = [
  "will-russia-will-be-in-a-state-of-c",
  "will-a-coup-or-regime-change-take-p",
  "will-eliezer-yudkowsky-publicly-cla",
  "will-the-us-software-engineering-pr",
  "will-the-phrase-effective-altruism-132828f94e20",
  "will-an-llm-have-been-reported-to-e",
  "at-the-end-of-2023-will-twitter-be",
  "will-starship-visit-the-moon-2023",
  "will-the-leftright-culture-war-come",
  "will-a-trustworthyish-user-go-rogue",
  "will-biden-be-the-2024-democratic-n",
  "will-a-single-shooting-incident-kil",
  "will-there-be-a-renewed-pace-of-vc",
  "ai-2023-person-of-the-year",
  "if-a-market-creator-who-is-wellknow",
  "will-betting-in-or-subsidizing-spec",
  "will-an-ai-get-gold-on-any-internat",
  "will-50-of-the-content-in-my-work-e",
  "will-people-care-about-prediction-m",
  "will-there-be-a-fully-selfsustainin",
  "-44f1eb7fc7a2",
  "will-at-least-10-forprofit-corporat",
  "will-cgp-greys-channel-cross-1-bill-3aaa9705ae11",
  "will-chatgpt-become-a-destination-s",
  "will-manifold-average-10k-daily-act",
  "will-manifold-limit-markets-to-199",
  "will-manifold-introduce-stop-orders",
  "will-manifold-hit-5000-active-users-7c1681b46fd7",
  "will-i-decide-that-there-is-a-bette",
  "will-the-us-government-commit-to-a",
  "by-the-end-of-2023-would-i-pay-half",
  "will-there-be-an-antiai-terrorist-i",
  "will-we-get-acquired",
  "will-an-ai-winter-happen-by-2030",
  "will-google-send-bard-to-the-gravey",
  "will-any-model-in-the-gpt-series-dr",
  "will-joe-biden-openly-convert-to-ea-3b625d190a8e",
  "in-2028-will-ai-be-at-least-as-big",
  "will-scott-alexander-blog-about-sil",
  "will-h5n1-kill-more-than-10-thousan",
  "will-polymarkets-smart-contract-be",
  "will-there-be-an-earthquake-in-engl",
  "will-president-biden-mint-the-coin",
  "if-manifold-gets-negative-news-cove",
  "will-realdonaldtrump-tweet-in-2023",
  "will-twitter-beat-tumblr-at-97-deva",
  "will-nick-bostrom-philosopher-exist",
  "45-will-an-ordinary-person-be-able",
  "37-will-the-us-unemployment-rate-no",
  "5-will-there-be-a-lasting-ceasefire",
  "28-will-twitters-net-income-be-high",
  "14-will-there-be-more-than-25-milli",
  "50-will-someone-release-dalle-but-f",
  "8-will-a-nuclear-weapon-be-detonate",
  "will-rick-astley-ever-gonna-give-yo",
  "will-someone-finally-write-a-post-o",
  "will-lex-fridman-interview-a-guest",
  "will-chuck-get-laid-before-2025",
  "will-a-manifold-subscription-includ",
  "will-most-miles-in-the-us-be-driven",
  "will-the-sp-500-index-close-both-10",
  "will-any-speech-model-exceed-chatgp",
  "will-bitcoin-ever-see-fourdigit-pri",
  "will-eu-natural-gas-prices-top-5-pe",
  "will-any-massproduced-electric-car",
  "by-the-end-of-2023-will-any-twitter",
  "convince-me-will-i-learn-lisp-in-20",
  "will-updateless-decision-theory-hav",
  "will-the-word-stablecoin-be-added-t",
  "by-2030-will-there-be-an-bottomup-t",
  "will-nancy-pelosi-resign-her-congre",
  "will-scott-alexander-shut-down-acx",
  "will-gpt4-be-unreliable-at-reasonin",
  "will-sbf-take-a-plea-deal",
  "will-gpt4-cause-a-similar-economic",
  "will-andrew-tate-be-found-guilty-of-10917660fc94",
  "will-manifold-add-a-limit-sell-acti",
  "will-manifold-support-direct-messag",
  "a-netflix-liveaction-show-will-be-h",
  "will-iran-conduct-a-nuclear-weapons",
  "will-russia-conduct-a-nuclear-weapo-19960da68732",
  "will-north-korea-conduct-a-nuclear-36f06f22f954",
  "will-elon-musk-say-publicly-that-he",
  "will-changpeng-zhao-cz-be-charged-w",
  "will-manifold-have-a-6h-outage-by-2",
  "will-sbf-skip-bail",
  "will-people-start-trying-to-mislead",
  "will-m-be-declared-by-a-regulator-t",
  "in-the-acx-2023-prediction-contest-1b0e37bda1a1",
  "will-elon-musk-make-lex-fridman-twi",
  "will-manifold-attempt-to-ban-or-sev",
  "will-the-moon-still-exist-on-march",
  "will-there-be-an-ea-global-conferen",
  "will-manifold-implement-stoploss-ne",
  "will-linux-pass-5-desktop-pc-market",
  "will-any-antiai-art-law-be-created",
  "will-there-be-any-largescale-protes",
  "are-sugar-rushes-real",
  "will-bryan-caplan-lose-any-of-his-p",
  "will-dearmoon-complete-its-mission",
  "will-i-be-employed-at-any-point-in",
  "will-an-aiauthored-story-win-a-shor",
  "will-grimes-issue-a-statement-on-ab-87b3d26edb08",
  "will-president-roberto-campos-neto",
  "will-xi-jinping-occupy-his-current",
  "will-anyone-hit-a-daily-streak-of-4",
  "will-alexei-navalny-be-alive-and-ou-2750ae3f9cd3",
  "in-the-2024-us-election-will-manifo",
  "will-it-be-possible-to-short-an-ans-8e5b379a30a8",
  "will-scott-alexander-write-an-acx-b",
  "if-the-ea-forum-wiki-changes-to-all",
  "will-the-ea-forum-support-users-est",
  "will-more-than-10-of-londoners-have",
  "in-a-year-will-peter-wildeford-beli-dcc4c593fe8c",
  "will-projects-which-received-grants",
  "by-the-end-of-2023-will-substantial",
  "will-twitter-have-more-daily-active",
];

export const fetchUser = async (
  username: string
): Promise<User | undefined> => {
  try {
    const fetchedUser = await getManifoldApi().getUser({ username });
    return fetchedUser;
  } catch (e) {
    console.error(e);
    return undefined;
  }
};

export class UserModel {
  balance: number;
  filledPositions: PositionModel[];
  // unFilledBets: PositionModel[];

  constructor(
    balance: number,
    filledPositions: PositionModel[]
    // unFilledBets: PositionModel[]
  ) {
    this.balance = balance;
    this.filledPositions = filledPositions;
    // this.unFilledBets = unFilledBets;
  }
}

export const buildUserModel = async (username: string): Promise<UserModel> => {
  const api = getManifoldApi();

  const manifoldUser = await api.getUser({ username });

  // Fetch bets with pagination
  // TODO combine with market.ts
  const allBets: Bet[] = [];
  let before: string | undefined = undefined;

  while (true) {
    const bets = await api.getBets({ username, before, limit: 1000 });
    allBets.push(...bets);

    // Break if:
    // - The latest page of bets is less than 1000 (indicating that there are no more pages)
    // - There are no bets at all
    // - There are no bets in the latest page (if the last page happened to be exactly 1000 bets)
    if (bets.length < 1000 || allBets.length === 0 || allBets.length === 0) {
      break;
    }

    before = allBets[allBets.length - 1].id;
  }

  // Fetch all the users bets, then construct positions from them
  // Note 1: partially filled bets still have the correct "amount" and "shares" fields
  // Note 2: including cancelled bets is also fine, this just refers to whether _new_ fills are cancelled
  const cpmmBets = allBets.filter(
    (bet) => bet.isFilled !== undefined || bet.amount < 0
  );
  // TODO handle these in some way
  const nonCpmmBets = allBets.filter(
    (bet) => bet.isFilled === undefined && bet.amount > 0
  );
  const betsByMarket = groupBy(cpmmBets, (bet) => bet.contractId);

  const cleanedContractsBetOn: Dictionary<{
    contractId: string;
    netYesShares: number;
    netLoan: number;
    evEstimate: number;
  }> = {};

  for (const marketId in betsByMarket) {
    const bets = betsByMarket[marketId].sort(
      (a, b) => b.createdTime - a.createdTime
    );
    const mostRecentProb = bets[0].probAfter;

    const netYesShares = bets.reduce((acc, bet) => {
      if (bet.outcome === "YES") {
        return acc + bet.shares;
      } else {
        return acc - bet.shares;
      }
    }, 0);
    const netLoan = bets.reduce((acc, bet) => acc + (bet.loanAmount ?? 0), 0);
    console.log(`${netYesShares} net shares in ${marketId}`);

    if (Math.abs(netYesShares) >= 1) {
      cleanedContractsBetOn[marketId] = {
        contractId: marketId,
        netYesShares: netYesShares,
        netLoan,
        // this is really just here for information architecture reasons, it's not necessary atm
        evEstimate: mostRecentProb * netYesShares,
      };
    }
  }

  const contractsByEstEV = Object.values(cleanedContractsBetOn).sort(
    (a, b) => b.evEstimate - a.evEstimate
  );

  const markets = await Promise.all(
    contractsByEstEV.map(({ contractId }) => api.getMarket({ id: contractId }))
  );

  const openMarkets = markets.filter(
    (market) =>
      market.isResolved === false &&
      market.closeTime &&
      market.closeTime > Date.now()
  );

  const positions = openMarkets.map((market) => {
    const bet = cleanedContractsBetOn[market.id];
    const isYesBet = bet.netYesShares > 0;

    const probability = isYesBet ? market.probability : 1 - market.probability;
    const payout = Math.abs(bet.netYesShares);

    return {
      probability,
      payout,
      loan: bet.netLoan,
      // ev: probability * payout, // debug
    };
  });

  return new UserModel(manifoldUser.balance, positions);
};
