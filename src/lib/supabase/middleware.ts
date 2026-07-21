import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Missing env on Vercel causes MIDDLEWARE_INVOCATION_FAILED — fail soft.
  if (!url || !anonKey) {
    if (request.nextUrl.pathname.startsWith("/app")) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.searchParams.set("error", "missing_supabase_env");
      return NextResponse.redirect(login);
    }
    return NextResponse.next({ request });
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(url, anonKey, {
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
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    if (!user && path.startsWith("/app")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", path);
      return NextResponse.redirect(redirectUrl);
    }

    if (user && (path === "/login" || path === "/signup")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/app";
      return NextResponse.redirect(redirectUrl);
    }

    if (user && path.startsWith("/app")) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsEnroll = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal1";
      const needsVerify = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

      if (needsEnroll && path !== "/app/mfa/enroll") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/app/mfa/enroll";
        return NextResponse.redirect(redirectUrl);
      }

      if (needsVerify && path !== "/app/mfa/verify") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/app/mfa/verify";
        return NextResponse.redirect(redirectUrl);
      }

      if (!needsEnroll && !needsVerify && path.startsWith("/app/mfa")) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/app";
        return NextResponse.redirect(redirectUrl);
      }
    }

    return supabaseResponse;
  } catch (error) {
    console.error("middleware updateSession failed", error);
    return NextResponse.next({ request });
  }
}
