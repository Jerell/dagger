import { BrowserContext } from "playwright";

type Options = {
  domain?: string;
  token: string;
};

export default async function setAuthorizationForOauth2Proxy(
  browserContext: BrowserContext,
  options: Options,
): Promise<void> {
  const { token, domain } = options;
  await browserContext.route(
    (url) => domain === undefined || url.host === domain,
    async (route, request) => {
      route.continue({
        headers: {
          Authorization: `Bearer ${token}`,
          ...request.headers(),
        },
      });
    },
  );
}
