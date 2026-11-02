# Guía: activar WhatsApp oficial para Filo (Hito 6)

Esto lo hace Henry (ADR-027): crear cuentas y poner datos de pago tiene que hacerlo una persona. Los
nombres de las pantallas de Meta cambian seguido; si algo no coincide, busca la opción parecida.

**Nunca pegues tokens ni claves en un chat.** Van directo en Vercel.

## 1. La SIM

1. Compra una SIM nueva para la barbería.
2. Actívala y confirma que recibe SMS.
3. **No instales WhatsApp con ese número.** Si ya lo tiene, hay que borrarlo antes.

## 2. Cuenta de negocio en Meta

1. Entra a [business.facebook.com](https://business.facebook.com) y crea el portafolio de negocio de
   la barbería.
2. En el Centro de seguridad, inicia la verificación del negocio. Ten a mano nombre legal, dirección,
   teléfono y un documento que lo acredite (por ejemplo el RUT o la matrícula mercantil). Puede tardar
   días.

## 3. La app de WhatsApp

1. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo negocio y
   conéctala al portafolio.
2. Agrega el producto **WhatsApp**. Meta entrega un número de prueba: con ese se construye mientras
   llega la verificación. Avísame cuando esté.

## 4. El número real

1. En WhatsApp Manager agrega la SIM y confirma el código que llega por SMS o llamada.
2. Pon el nombre visible, por ejemplo "Filo Barbería". Meta lo revisa.
3. Crea el PIN de verificación en dos pasos y guárdalo en tu gestor de contraseñas.

## 5. Pago y tarifa

1. Agrega la tarjeta en la cuenta de WhatsApp. Sin método de pago, los mensajes se detienen.
2. Busca la tabla de precios de Colombia en COP en
   [la página de precios de Meta](https://business.whatsapp.com/products/platform-pricing) y dime
   cuánto cuesta el mensaje de **utilidad**. Esperamos unos $3 COP.

## 6. Las dos plantillas

En WhatsApp Manager crea dos plantillas de categoría **Utilidad**, idioma **Spanish** (código `es`,
no una variante regional: TurnOS las envía con ese código y debe coincidir):

**`turno_faltan_dos`**

```text
Hola {{1}}, en {{2}} ya casi es tu turno (≈ {{3}}). Ve saliendo. Sigue tu turno aquí: {{4}}
```

**`turno_te_llaman`**

```text
{{1}}, te están llamando en {{2}}. Tienes {{3}} minutos para llegar. Tu turno: {{4}}
```

Meta puede tardar en aprobarlas. Si las rechaza o las pasa a marketing, avísame con el motivo.

## 7. Token y variables en Vercel

1. En el portafolio crea un **usuario del sistema** con permisos `whatsapp_business_messaging` y
   `whatsapp_business_management`, y genera un token que no expire.
2. En Vercel → proyecto `turnos` → Settings → Environment Variables, agrega en producción:

| Variable                   | Dónde sale                                    |
| -------------------------- | --------------------------------------------- |
| `WHATSAPP_ACCESS_TOKEN`    | El token del usuario del sistema              |
| `WHATSAPP_PHONE_NUMBER_ID` | Configuración de la API de WhatsApp en la app |
| `WHATSAPP_APP_SECRET`      | Configuración básica de la app                |
| `WHATSAPP_VERIFY_TOKEN`    | Una clave larga que inventas tú               |

## 8. Webhook

Esto va cuando el código del Hito 6 esté en producción.

1. En la app, WhatsApp → Configuración → Webhook:
   - URL: `https://turnos-smoky-nine.vercel.app/api/whatsapp/webhook`
   - Token de verificación: el mismo `WHATSAPP_VERIFY_TOKEN`.
2. Suscríbete al campo `messages`.

## 9. Encender en Filo

1. En `/admin/privacidad`, publica la versión nueva del aviso, que menciona WhatsApp. Los clientes
   tendrán que aceptarla otra vez.
2. En `/admin/negocio`, guarda el número actual de la barbería y enciende el aviso automático.
3. Prueba en la barbería: un turno con la casilla marcada, los dos avisos, y responder "PARAR".
