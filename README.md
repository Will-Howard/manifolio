# Manifolio

Bet size calculator for YES/NO questions on [manifold markets](https://manifold.markets/). For a given probability, it calculates the optimal bet to place according to the [Kelly criterion](https://en.wikipedia.org/wiki/Kelly_criterion), i.e. maximising expected log wealth.

[Go to site.](https://manifol.io/)

## Table of Contents
1. [Guide](#guide)
2. [Acknowledgements](#acknowledgements)

## Guide

For the uninitiated, the Kelly criterion has some nice properties which means it's probably the best strategy to use when making bets:

- Over the long run, it is guaranteed to outperform any other strategy at a given percentile of wealth. I.e. the median outcome of someone using the Kelly criterion will beat the median outcome of someone with the same beliefs using any other strategy, and so will the 99th percentile outcome.
- Given a specific wealth goal, it minimises the expected time to reach that goal compared to any other strategy.
- A market where all participants bet according to the Kelly criterion learns at the optimal rate ([source](https://people.cs.umass.edu/~wallach/workshops/nips2011css/papers/Beygelzimer.pdf)).

There is a formula which can be used in the case of simple bets taken one at a time, with fixed odds:
```
f = p - q / b
```
 - f - The fraction of your bankroll to bet
 - p - The probability of a win
 - q - 1 - p
 - b - The odds of the market, in terms of "[english odds](https://www.investopedia.com/articles/investing/042115/betting-basics-fractional-decimal-american-moneyline-odds.asp)" in this case

This doesn't work that well on manifold or other prediction markets, because:
 - A lot of markets are quite thinly traded, so the odds move a lot in response to your bet.
 - You bet on several things at the same time, so you don't have a fixed bankroll. You have a balance, plus a portfolio of other bets with have a range of possible outcomes.

This calculator accounts for those two things, plus some other stuff like how you should bet if you already have an open position.

### Usage instructions

![Manifolio Screenshot](images/screenshot.png)

Input your **username**, the **url of the market** you want to bet on, and your **estimate of the true probability**. It will then tell you the amount to bet to maximise your log wealth, _given that your estimate is correct_.

You can put in your manifold API key (found [here](https://manifold.markets/profile)) to place bets via the calculator. This isn't necessary for it to work though, just the username is required (and you can even try other people's usernames for fun).

<br/>

There is also a **deferral factor** field in "Advanced options", which I would recommend you use (or at least I would recommend you leave it around 50%, which is the default).

When people use the Kelly formula in practice, they usually bet [some fixed fraction](https://www.lesswrong.com/posts/TNWnK9g2EeRnQA8Dg/never-go-full-kelly) of the recommended amount to be more risk averse. The deferral factor is exactly equivalent to this. If a market had enough liquidity that the odds were effectively fixed, then a deferral factor of 50% would correspond to betting 50% of the Kelly formula amount.

The """bayesian""" interpretation of this number is that you are factoring in some chance that the market is right and you are wrong, so a deferral factor of 10% means you think there is a 10% chance you are right and a 90% that the market is right*. Or, equivalently again, that the actual probability to use in the calculation is 10% of the way from the market's estimate to your estimate. If this is all too confusing just remember that setting it to 100% can cause you to lose money by being overconfident, so you should probably leave it at some middling value.

### Things to watch out for/known issues

 - Selling positions is handled by buying the opposite side. So if you have YES shares in a market and you are now predicting a much lower probability, it will tell you to buy NO. This is equivalent to selling YES shares, and you do in fact get mana back when you do this. 1 NO + 1 YES share cancel out to produce M1.
 - The "Annual return" numbers are very important. The calculation comes up with the best bet it can _given a certain edge, and a certain time to resolution_. If the time to resolution is very long or your edge over the market is very small you can still end up not doing that well. Other things to note about these numbers:
   - The "Annual return from a portfolio of similar bets" number can sometimes be negative (if you have an existing position and are now changing it). This is "technically correct" as far as I understand, it can be better to sacrifice some expected value in return for an increase in expected log value.
   - The "Annual return if this were your only bet" number can also go negative. I believe this one is a bug to do with it not fully simulating the range of possible outcomes in this part of the calculation (whereas it does when coming up with the bet recommendation). It should only be slightly off, and I'm more confident that the bet recommendation is accurate than that this number is accurate
 - Currently it doesn't account for "Free response" or "Multiple choice" markets properly when simulating the range of possible outcomes, it just treats them as cash equal to their expected value. If you have a lot of money in these markets this will means the recommendation will be a bit too high (because it's ignoring some risk).
 - Complications related to the manifold loan system: If you have outstanding loans greater than your total balance, the technically correct thing to do is to bet M0. This is because log(0) is negative infinity, so any chance of ending up with 0 net worth gets an infinite penalty when maximising log wealth. This is pretty conservative though, as the chance of this happening can be vanishingly small if you have a reasonably diversified portfolio. If it were to follow this then for most power users it would recommend a bet of 0 which would rather defeat the point. Instead, I have made it treat the worst cast as the _worst outcome that it actually simulates_ (out of 50,000 simulations), rather than the actual worst _possible_ case (which is every bet resolving against you).

<!-- ## Local setup

You can run the site locally like so:
```bash
git clone https://github.com/Will-Howard/manifolio.git
cd manifolio/manifolio-ui
yarn install
yarn dev
```

There are just two environment variables you might want to set (in a `.env` file or otherwise):
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
``` -->

## Acknowledgements

Thanks to the people who kindly funded this project on [Manifund](https://manifund.org/projects/a-tool-for-making-well-sized-kelly-optimal-bets-on-manifold?tab=shareholders):
 - Patrick Purvis
 - Domenic Denicola
 - Tyler Heishman
 - Guenael Strutt
 - Austin Chen
 - Carson Gale
