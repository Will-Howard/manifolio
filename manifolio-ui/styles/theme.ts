import { Figtree, Lato } from "next/font/google";

const lato = Lato({ weight: "900", subsets: ["latin"] });
const figtree = Figtree({ weight: "400", subsets: ["latin"] });

const xs = 0;
const sm = 600;
const md = 960;
const lg = 1280;
const xl = 1400;

type Breakpoints = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

export type Theme = {
  background: string;
  border: {
    main: string;
  };
  primary: string;
  primaryLight: string;
  headingFont: string;
  bodyFont: string;
  breakpoints: Breakpoints;
};

export const theme: Theme = {
  background: "#F5F5F5",
  border: {
    main: "#2D0070",
  },
  primary: "#002654",
  primaryLight: "#002674",
  headingFont: `Gill Sans, Gill Sans MT, ${lato.style.fontFamily}, Calibri, sans-serif`,
  bodyFont:
    "Petrona, Iowan Old Style, Apple Garamond, Baskerville, Times New Roman, Times, Source Serif Pro, serif",
  breakpoints: {
    xs: `@media screen and (max-width: ${xs}px)`,
    sm: `@media screen and (max-width: ${sm}px)`,
    md: `@media screen and (max-width: ${md}px)`,
    lg: `@media screen and (max-width: ${lg}px)`,
    xl: `@media screen and (max-width: ${xl}px)`,
  },
};
