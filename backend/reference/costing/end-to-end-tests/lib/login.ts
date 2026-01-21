import { BrowserContext } from "playwright";
import setAuthorizationForOauth2Proxy from "./oauth2-proxy-login";

export default async function login({ context }: { context: BrowserContext }) {
  await setAuthorizationForOauth2Proxy(context, {
    token: process.env["AUTH_TOKEN"] ?? "missing_token",
  });
}
