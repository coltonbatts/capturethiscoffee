import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAppUser } from "@/lib/auth";
import {
  isAuthDisabled,
  supabaseConfigError,
  type Database,
} from "@/lib/supabase";

const protectedPathPattern =
  /^\/(people|clients|labels|productions\/new)(\/|$)/;

export async function proxy(request: NextRequest) {
  if (isAuthDisabled) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  if (supabaseConfigError || !supabaseUrl || !supabaseAnonKey) {
    if (protectedPathPattern.test(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ((!user || !isAdminAppUser(user)) && protectedPathPattern.test(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Only admins get bounced off the login page. A signed-in non-admin stays
  // here so the login page can explain that the account needs admin access,
  // instead of silently looping back to a protected route.
  if (user && isAdminAppUser(user) && pathname === "/login") {
    return NextResponse.redirect(new URL("/productions", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/productions/:path*",
    "/people/:path*",
    "/clients/:path*",
    "/labels/:path*",
    "/login",
  ],
};
