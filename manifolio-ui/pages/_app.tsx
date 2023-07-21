import _logger from "@/logger";
import { theme } from "@/styles/theme";
import type { AppProps } from "next/app";
import { ThemeProvider } from "react-jss";
import { datadogRum } from "@datadog/browser-rum";

const ddAppId = process.env.NEXT_PUBLIC_DD_APP_ID;
const ddClientToken = process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN;
export const ddEnv = process.env.NEXT_PUBLIC_ENV;

if (ddAppId && ddClientToken && ddEnv) {
  datadogRum.init({
    applicationId: ddAppId,
    clientToken: ddClientToken,
    site: "datadoghq.com",
    service: "manifolio",
    env: ddEnv,
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input",
  });

  datadogRum.startSessionReplayRecording();
}

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
