# Manifolio

Manifolio is a bet size calculator for [manifold markets](https://manifold.markets/). For a given probability, it calculates the optimal bet to place according to the [Kelly criterion](https://en.wikipedia.org/wiki/Kelly_criterion).

You can visit the website [here](https://manifol.io/).

## Table of Contents
1. [Guide](#guide)
2. [Local setup](#local-setup)
3. [Acknowledgements](#acknowledgements)

## Guide

For the uninitiated, the Kelly criterion has some nice properties which means it's probably the best strategy to use when making bets:

- Over the long run, it is guaranteed to outperform any other strategy at a given percentile of wealth. I.e. the median outcome of someone using the Kelly criterion will beat the median outcome of someone with the same beliefs using any other strategy. And so will the 99th percentile outcome.
- Given a specific wealth goal, it minimises the expected time to reach that goal compared to any other strategy.
- A market where all participants bet according to the Kelly criterion learns at the optimal rate ([source](https://people.cs.umass.edu/~wallach/workshops/nips2011css/papers/Beygelzimer.pdf)).

There is a simple formula which can be used in the case of simple bets taken one at a time, with fixed odds:
```
f = p - q / b
```
 - f - The fraction of your bankroll to bet
 - p - The probability of a win
 - q - 1 - p
 - b - The odds of the market, in terms of "[english odds](https://www.investopedia.com/articles/investing/042115/betting-basics-fractional-decimal-american-moneyline-odds.asp)" in this case

This doesn't work that well on manifold or other prediction markets, because:
 - A lot of markets are quite thinly traded, so the odds move a lot in response to your bet
 - You bet on several things at the same time, so you don't have a fixed bankroll. You have a balance, plus a portfolio of other bets with have a range of possible outcomes

This calculator accounts for those two things.

### Usage instructions

![Manifolio Screenshot](images/screenshot.png)

What all the fields mean:
 - User: Your username
   - Balance: self explanatory
   - Total loans: self explanatory
   - Portfolio value:
 - Market: The url of the market you want to bet on
   - Market probability:
   - Your position: The 
   - Est. time to resolution: This is currently just the time to market close. It's used in the calculation of the "annual return" fields below. In general markets with very long 
 - Prob. estimate: Your estimate of the true probability of the question resolving YES
 - Kelly fraction: . The exact meaning of this number is that the 


### Things to watch out for/known issues

 - Currently it only handles YES/NO markets, and multiple choice markets are just ignored in the calculation of portfolio value. This will tend to make the bet recommendation too low in the case where you have a lot of value tied up in multiple choice markets.
 - Selling positions is handled by buying the opposite side. So if you have 50 YES shares in a market and you are now predicting a much lower probability, it will tell you to buy NO. This is exactly equivalent to selling YES shares, and you do in fact get mana back when you do this, 1 NO + 1 YES share cancel out to produce M1. I appreciate this is a little confusing, I did it like this to make the maths simpler, I may change it in future.
 - If you have outstanding loans greater than your total balance, it will tell you not to bet anything. This is technically correct under strict Kelly betting, because if this is the case it means you have some chance of ending up with a negative balance in the long run (you have to pay back your loans when a market resolves, so if all your markets resolve against you, you will have a negative portfolio value). Because we are maximising the logarithm of wealth, and the logarithm of 0 approaches negative infinity, you get an infinite penalty if there is any chance of ending up below 0. The way the manifold loan system works (by my recollection, and at time of writing) is you get 2% of your initial investment back per day. So if you invest in long term markets, which is seen as a virtuous thing to do, you can easily end with loans way higher than your balance. To bring them back down you can sell off longer term markets that you have a lot of mana in, or buy more mana.
 - The "Annual return" numbers are very important. The calculation comes up with the best bet it can _given a certain edge, and a certain time to resolution_. If the time to resolution is very long or your edge is very small you can still end up not doing that well. Other things to note about these numbers:
   - The "Annual return from a portfolio of similar bets" number can sometimes be negative (if you have an existing position and are now changing it). This is another thing which is "technically correct", it can be better to sacrifice some expected value in return for some expected log value. There may also be cases where this is a bug, but if it's small it's probably valid
   - The "Annual return if this were your only bet" number can also go negative. This one _is_ a bug, and as I understand it it's due to fact that this calculation treats part of the portfolio value as a fixed expected value. The calculation of the optimal bet does account

## Local setup

You can run the site locally like so:
```bash
git clone https://github.com/Will-Howard/manifolio.git
cd manifolio/manifolio-ui
yarn install
yarn dev
```

There are just two non-essential environment variables you might want to set (in a `.env` file or otherwise):
```
NEXT_PUBLIC_LOG_LEVEL=debug # "debug" | "info" | "warn" | "error", not yet used very consistently
NEXT_PUBLIC_MANIFOLD_API_URL=http://localhost:3000 # or e.g. https://dev.manifold.markets
```

These are the `node` and `yarn` versions I'm using in case you run into trouble:
```bash
$ node -v
v19.8.1
$ yarn -v
1.22.19
```

## Acknowledgements

Thanks to the people who kindly funded this project on [Manifund](https://manifund.org/projects/a-tool-for-making-well-sized-kelly-optimal-bets-on-manifold?tab=shareholders):
 - Patrick Purvis
 - Domenic Denicola
 - Tyler Heishman
 - Guenael Strutt
 - Austin Chen
 - Carson Gale
