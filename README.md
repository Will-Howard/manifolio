# Manifolio

Manifolio is a bet size calculator for [manifold markets](https://manifold.markets/). For a given probability, it calculates the optimal bet to place according to the [Kelly criterion](https://en.wikipedia.org/wiki/Kelly_criterion).

You can visit the website [here](https://manifol.io/).

## Table of Contents
1. [Guide](#guide)
2. [Local setup](#local-setup)
3. [Acknowledgements](#acknowledgements)

## Guide

For the uninitiated, the Kelly criterion has some nice properties which means it's probably the best strategy to use when making bets:

- Over the long run, it is guaranteed to outperform any other strategy at a given percentile of wealth. I.e. the median outcome of someone using the Kelly criterion will beat the median outcome of someone with the same beliefs using any other strategy. And so will the 99th percentile outcome. (TODO source)
- Given a specific wealth goal, it minimises the expected time to reach that goal compared to any other strategy. (TODO source)
- A market where all participants bet according to the Kelly criterion learns at the optimal rate ([source](https://people.cs.umass.edu/~wallach/workshops/nips2011css/papers/Beygelzimer.pdf)).

## Local setup

You can run the site locally like so:
```bash
git clone https://github.com/Will-Howard/manifolio.git
cd manifolio/manifolio-ui
yarn install
yarn dev
```

There are just two (non-essential) environment variables you might want to set:
```
NEXT_PUBLIC_LOG_LEVEL=debug # "debug" | "info" | "warn" | "error", not yet used very consistently
NEXT_PUBLIC_MANIFOLD_API_URL=http://localhost:3000 # or e.g. https://dev.manifold.markets
```

I have been using node v18, I'm not sure if it will work with other versions

## Acknowledgements
