import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/konzept");

  if (!user && path.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/app")) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsEnroll = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal1";
    const needsVerify = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

    if (needsEnroll && path !== "/app/mfa/enroll") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/mfa/enroll";
      return NextResponse.redirect(url);
    }

    if (needsVerify && path !== "/app/mfa/verify") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/mfa/verify";
      return NextResponse.redirect(url);
    }

    if (!needsEnroll && !needsVerify && path.startsWith("/app/mfa")) {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  if (!user && path === "/") {
    // public landing ok
  }

  void isAuthRoute;
  return supabaseResponse;
}
