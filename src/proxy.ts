import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { redirectForDisabled } from "@/lib/domain/modules";
import { shouldBounceLoginToApp } from "@/lib/domain/staff-entry";

/**
 * Proxy (antes "middleware") de Next.js 16:
 *  - refresca la sesión de Supabase en cada petición a rutas del personal (REQ-030.3)
 *  - sin sesión, /app/* y /admin/* redirigen a /entrar (REQ-030.1)
 * La comprobación de ROL (dueño vs barbero) se hace en los layouts, con la base de datos.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token contra Supabase (no confiar en getSession() en el servidor).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // REQ-079.5: la ruta de un módulo apagado lleva al inicio de quien la abre (sin error)
  const disabledTo = redirectForDisabled(pathname);
  if (disabledTo) {
    const url = request.nextUrl.clone();
    url.pathname = disabledTo;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const isStaffRoute = pathname.startsWith("/app") || pathname.startsWith("/admin");

  if (isStaffRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("volver", pathname);
    return NextResponse.redirect(url);
  }

  // `?motivo=sin-negocio` no rebota a /app: la cuenta sin negocio vería un ciclo (REQ-080.1)
  if (
    pathname === "/entrar" &&
    shouldBounceLoginToApp(!!user, request.nextUrl.searchParams.get("motivo"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/entrar", "/crear-negocio"],
};
