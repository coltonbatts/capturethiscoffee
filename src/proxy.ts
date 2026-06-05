import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isStaffUser } from "@/lib/auth";
import {
  isAuthDisabled,
  supabaseConfigError,
  type Database,
} from "@/lib/supabase";

const protectedPathPattern = /^\/(productions|people|clients)(\/|$)/;
const staffDeniedParam = "staff";

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
  const staff = isStaffUser(user);

  if (!user && protectedPathPattern.test(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && !staff && protectedPathPattern.test(pathname)) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(staffDeniedParam, "1");
    return NextResponse.redirect(loginUrl);
  }

  if (user && staff && pathname === "/login") {
    return NextResponse.redirect(new URL("/productions", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/productions/:path*", "/people/:path*", "/clients/:path*", "/login"],
};
