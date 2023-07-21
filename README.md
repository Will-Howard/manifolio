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
 - p - The true probability of a win
 - q - 1 - p
 - b - The odds of the market, in terms of "[english odds](https://www.investopedia.com/articles/investing/042115/betting-basics-fractional-decimal-american-moneyline-odds.asp)"

This doesn't work that well on manifold or other prediction markets, because:
 - A lot of markets are quite thinly traded, so the odds move a lot in response to your bet
 - You bet on several things at the same time, so you don't have a fixed bankroll. You have a balance, plus a portfolio of other bets with have a range of possible outcomes

This calculator accounts for those two things.

### Usage instructions

![Manifolio Screenshot](images/screenshot.png)

### Things to watch out for

 - 
 - Currently it only handles YES/NO markets, and multiple choice markets are just ignored in the calculation of portfolio value. This will tend to make the bet recommendation too low in the case where you have a lot of value tied up in multiple choice markets

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
