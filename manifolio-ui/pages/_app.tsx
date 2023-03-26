import { theme } from "@/styles/theme";
import type { AppProps } from "next/app";
import { ThemeProvider } from "react-jss";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
