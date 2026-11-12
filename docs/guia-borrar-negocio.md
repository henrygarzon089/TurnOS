# Guía: borrar un negocio (Filo)

Procedimiento de REQ-080.3 y REQ-080.4 (T-190, design.md §23.6). Se usa **una sola vez**, para
borrar **Filo** (`/filo`) antes de crear **Gamma Club**.

> **No tiene vuelta atrás.** Borra los turnos, clientes, ventas, cierres de caja, inventario,
> limpieza, membresías, tarjetas de regalo y las cuentas del personal de Filo. Haz el respaldo del
> paso 2 antes de confirmar.

## 1. Lo que necesitas

- Estar en la carpeta del repositorio (`turnOS`), al día con `main`.
- `psql` y `pg_dump`. En el Mac: `brew install libpq` y luego
  `echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc`, y abre otra terminal.
  Revisa con `psql --version` (17 o más nuevo).
- La cadena de conexión del proyecto de producción, en el panel de Supabase: botón **Connect** →
  **Session pooler** (puerto **5432**) o **Direct connection**. **No uses el "Transaction pooler"
  (puerto 6543)**: el script crea funciones temporales que solo viven en una sesión.
- Un momento tranquilo (sin clientes en la fila de Filo): durante el borrado, que dura unos
  segundos, las tablas del negocio quedan bloqueadas para escribir.

Guarda la cadena en una variable de la terminal para no pegarla en cada comando (no la guardes en
ningún archivo ni la compartas):

```bash
export DB_URL='postgresql://postgres.<REF-DEL-PROYECTO>:<CONTRASEÑA>@<HOST-DEL-POOLER>:5432/postgres'
```

## 2. Respaldo (antes de todo)

```bash
pg_dump "$DB_URL" --data-only -n public -n auth -f respaldo-antes-de-borrar-filo.sql
```

El archivo tiene datos de clientes y cuentas: guárdalo en un lugar privado, **no** lo subas al
repositorio ni lo compartas, y bórralo cuando Gamma Club ya esté andando.

## 3. Simulación (no borra nada)

```bash
psql "$DB_URL" -v slug=filo -f scripts/delete-business.sql
```

Imprime:

1. **Negocio** y su **id** (anótalo: es el nombre de la carpeta en Storage).
2. **Filas del negocio por tabla**: cuántas filas se borrarían en cada tabla con `business_id`
   (las tablas se leen del esquema, así que una tabla nueva sale sola). Arriba van las que tienen
   filas.
3. **Cuentas del personal**: el correo de cada cuenta y si **se borra** (`t`) o se conserva (`f`,
   porque tiene membresía o barbero en otro negocio).
4. La línea **SIMULACIÓN: no se borró nada**.
5. **Archivos en Storage** del negocio en los buckets `media` y `cleaning`.

Qué revisar antes de confirmar:

- Que el negocio sea **Filo** (slug `filo`). Si sale `No existe un negocio con el enlace "filo"`,
  revisa el enlace: no se borró nada.
- Que los números se vean razonables: `public.businesses` = 1, y turnos, clientes y ventas con lo
  que esperas de Filo.
- Que en **Cuentas del personal** salgan el correo del dueño de Filo y las cuentas de sus barberos
  (`…@barberos.turnos.local`), todas con `t`. Si alguna sale `f`, esa cuenta se conserva.
- Si sale `El rol … no se salta RLS`, te conectaste con otro usuario: usa el usuario `postgres`
  de la cadena del panel. No sigas.

## 4. Borrado (con confirmación)

Solo si la simulación se ve bien. `confirm` tiene que ser **exactamente** el slug:

```bash
psql "$DB_URL" -v slug=filo -v confirm=filo -f scripts/delete-business.sql
```

Todo pasa en **una transacción**: si algo falla, sale un `ERROR` y **no se borra nada**. Al final
imprime las filas borradas por tabla, la línea `auth.users (cuentas del personal que se borran)` y
`Listo: el negocio filo y sus cuentas del personal se borraron.`

Por dentro, el script apaga **solo durante esa transacción** los disparadores de las tablas del
negocio (las guardas de inmutabilidad de ventas, cierres de caja y movimientos de inventario no
dejan borrar), borra primero las tablas de inventario a las que no llega la cascada, luego el
negocio con todo lo demás en cascada, revisa que no quede ni una fila, vuelve a encender los
disparadores y borra las cuentas del personal que no tengan otro negocio.

Para comprobar, corre otra vez la simulación: debe decir `No existe un negocio con el enlace
"filo"`.

Si el borrado falla en el paso de las cuentas (`permission denied for table users` u otro error de
`auth.users`), no se borró nada: avísale al equipo con el error completo. Como plan B, se pueden
borrar las cuentas a mano después en **Authentication → Users**.

## 5. Archivos en Storage (desde el panel)

SQL no borra los archivos del disco; se borran en el panel de Supabase:

1. **Storage** → bucket **`media`** → carpeta con el **id** del negocio (el del paso 3) → marca
   todo → **Delete**. Ahí están las fotos de barberos y de productos.
2. **Storage** → bucket **`cleaning`** → carpeta con el mismo **id** → marca todo → **Delete**.
   Ahí están las fotos y PDF de limpieza.

Si no hay carpeta con ese id en un bucket, no hay nada que borrar ahí.

## 6. Después: crear Gamma Club (PA-H17-3)

El dueño de Gamma Club usa **el mismo correo** que el dueño de Filo. Ese correo era una cuenta de
dueño de Filo, así que el borrado **también borró esa cuenta**: hay que **registrarse de nuevo**
con ese correo desde **Crear negocio** y crear Gamma Club con el enlace `gamma-club`.

- Hazlo **antes** de desplegar la versión que cierra "Crear negocio" (REQ-080.1).
- Las cuentas de los barberos de Filo también se borraron: si van a trabajar en Gamma Club, se
  les invita de nuevo desde Gamma Club.
