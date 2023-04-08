import _logger from "@/logger";
import { theme } from "@/styles/theme";
import type { AppProps } from "next/app";
import { ThemeProvider } from "react-jss";

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace globalThis {
  let logger: typeof _logger;
}
globalThis.logger = _logger;

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
