/**
 * Dónde cae una cuenta con sesión pero sin negocio (REQ-080.1, design §23.4). Lógica pura.
 *
 * Con `signup` encendido va al asistente `/crear-negocio`. Con `signup` apagado va a `/entrar` con
 * `?motivo=sin-negocio`, que muestra "Tu cuenta no tiene un negocio.".
 *
 * Ciclo evitado: el proxy manda `/entrar` con sesión a `/app`, y el layout manda a la cuenta sin
 * negocio de vuelta a `/entrar`. Para cortarlo, `/entrar?motivo=sin-negocio` NO redirige a `/app`
 * aunque haya sesión (`shouldBounceLoginToApp`); así la persona ve el mensaje y puede entrar con
 * otra cuenta.
 */
export const NO_BUSINESS_REASON = "sin-negocio";
export const NO_BUSINESS_MESSAGE = "Tu cuenta no tiene un negocio.";

export function noBusinessDestination(signupEnabled: boolean): string {
  return signupEnabled ? "/crear-negocio" : `/entrar?motivo=${NO_BUSINESS_REASON}`;
}

/** `/entrar` con sesión lleva a `/app`, salvo que venga con el motivo `sin-negocio`. */
export function shouldBounceLoginToApp(
  hasUser: boolean,
  motivo: string | null | undefined,
): boolean {
  return hasUser && motivo !== NO_BUSINESS_REASON;
}
