import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase";
import { resolveSupabasePublicConfig } from "@/lib/supabase-config";
import {
  isProtectedOperatorPath,
  legacyRunnerRedirectUrl,
} from "@/lib/route-access";

export async function proxy(request: NextRequest) {
  const legacyRedirect = legacyRunnerRedirectUrl(request.nextUrl);
  if (legacyRedirect) {
    return NextResponse.redirect(legacyRedirect);
  }

  const publicConfig = resolveSupabasePublicConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const pathname = request.nextUrl.pathname;

  if (publicConfig.status === "error") {
    if (isProtectedOperatorPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicConfig.url,
    publicConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedOperatorPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/productions", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/productions/:path*",
    "/people/:path*",
    "/labels/:path*",
    "/login",
  ],
};
