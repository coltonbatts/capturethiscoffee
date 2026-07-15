/** Builds the compatibility redirect for legacy token-scoped runner links. */
export function legacyRunnerRedirectUrl(requestUrl: URL): URL | null {
  const match = requestUrl.pathname.match(/^\/productions\/([^/]+)\/?$/);
  if (!match || match[1] === "new" || !requestUrl.searchParams.has("token")) {
    return null;
  }

  const redirectUrl = new URL(requestUrl);
  redirectUrl.pathname = `/run/${match[1]}`;
  return redirectUrl;
}

export function isProtectedOperatorPath(pathname: string) {
  return /^\/(people|labels|productions)(\/|$)/.test(pathname);
}
