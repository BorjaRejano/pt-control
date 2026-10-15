# PT CONTROL · Versión 1.0

Aplicación personal de seguimiento de trabajos y permisos industriales. Interfaz en español (panel diario, calendario semanal, registro filtrable, archivo), acceso protegido y datos reales en PostgreSQL/Supabase. Cada instalación necesita su propio proyecto Supabase y usuario; las credenciales locales y los registros no se incluyen en este repositorio.

Repositorio: [BorjaRejano/pt-control](https://github.com/BorjaRejano/pt-control). Dirección de publicación: [PT CONTROL](https://borjarejano.github.io/pt-control/).

## 1. Lo que incluye esta versión

- Inicio de sesión por correo y contraseña con Supabase Auth; sin registro público desde la aplicación.
- Panel diario: permisos de hoy, próximos trabajos, sin programar y trabajos abiertos con fecha pasada.
- Cinco contadores: **sin programar**, **pendientes**, **emitidos**, **en ejecución** y **finalizados**. La programación y el estado son independientes: un pendiente sin fecha cuenta en ambos indicadores.
- Crear y editar trabajos; programarlos sin necesidad de introducir número de PT al principio.
- Estados: **pendiente**, **emitido**, **en ejecución**, **finalizado**. La condición de **ampliado NO es un estado**, sino un registro adicional.
- Varias ampliaciones por trabajo, conservando los números y fechas de cada una.
- Comentarios con fecha y hora; historial generado por triggers de la base de datos.
- Calendario semanal, filtros combinables por estado, rango de fechas, número, empresa, zona, descripción, ampliaciones y archivo; buscador y columnas ordenables.
- Fechas de referencia y horas del historial en `Europe/Madrid`. Actualización al guardar, recuperar el foco y cada minuto mientras la sesión está abierta.
- Descarga CSV (Excel) y copia JSON con trabajos, ampliaciones, comentarios e historial.
- Todas las tablas exigen usuario autenticado y tienen políticas RLS. No se sube información de permisos al repositorio de GitHub.

**Fuera del alcance de v1:** importación automática de Excel, varios días de ejecución para un mismo trabajo, adjuntos, envío de correos, informes PDF, restauración automatizada del backup JSON, edición/eliminación de ampliaciones/comentarios, notificaciones y permisos de varios usuarios.

## 2. Cómo preparar Supabase (una sola vez)

> **Importante:** antes de usar información de tu empresa, confirma que está autorizado almacenarla en una nube externa. Para las primeras pruebas utiliza únicamente permisos ficticios.

1. Crea un proyecto en [https://supabase.com/dashboard](https://supabase.com/dashboard). Conserva la contraseña administrativa fuera del repositorio.
2. Dentro del proyecto, entra en **SQL Editor → New query**. Ejecuta `supabase/migrations/001_pt_control.sql` **una sola vez** y después `supabase/migrations/002_integridad_historial.sql`. Se crean 4 tablas, índices, triggers de historial y políticas de seguridad. Si ya aplicaste `001`, ejecuta únicamente `002`: conserva tablas y registros y mejora el historial y la protección de metadatos. No vuelvas a ejecutar `001` sobre una instalación existente.
3. En **Authentication → Users → Add user**, crea tu único usuario manualmente, con correo y contraseña si aparece la opción **Create new user**. Confirma el email según la configuración del proyecto. Si el panel solo ofrece invitaciones, sigue el procedimiento de invitación y definición de contraseña en la interfaz oficial de Supabase (puede requerir configurar URLs de redirección).
4. En **Authentication** configura **Allow new users to sign up = OFF** y mantén desactivados los accesos anónimos. El proyecto de ejemplo no ofrece botón de registro. Al desactivar nuevos registros solo se permiten cuentas ya existentes.
5. En **Project Settings → API Keys** copia la **publishable key** (`sb_publishable_...`). Si tu proyecto únicamente ofrece una clave pública heredada `anon`, también sirve. **Nunca utilices la clave `service_role` o `secret` en esta web.** Copia asimismo la URL del proyecto (Project URL).
6. Comprueba en **Database → Tables / Policies** que `trabajos`, `ampliaciones`, `comentarios` e `historial_cambios` tienen RLS habilitado. Opcionalmente ejecuta **Security Advisor**.

### Esquema relacional

```text
auth.users (Supabase Auth)
   │
   └── 1:N trabajos ────────────────────────────────┐
          id (UUID)                                 │
          user_id (UUID)                            │
          descripcion                              │
          numero_permiso (opcional)                 │
          fecha_programada (opcional)               │
          zona / empresa                           │
          estado: pendiente/emitido/ejecucion/      │
                  finalizado                        │
          notas / archivado                        │
          created_at / updated_at                   │
              │                                    │
              ├── 1:N ampliaciones                 │
              │      numero_ampliacion             │
              │      fecha_ampliacion              │
              │      observaciones                 │
              │                                    │
              ├── 1:N comentarios                  │
              │      contenido / created_at        │
              │                                    │
              └── 1:N historial_cambios             │
                     tipo / resumen / created_at   │
                                                   │
          RLS: cada usuario lee y cambia           │
          exclusivamente sus registros ◄───────────┘
```

**Importante:** `fecha_programada = NULL` significa "sin programar" y es independiente de `estado`. Una ampliación es una entidad vinculada, no sobrescribe el número del PT original.

## 3. Abrir el proyecto en tu PC con Codex o VS Code

Requisitos: Node.js 22.12 o superior con npm.

1. Descomprime el ZIP. Abre la carpeta `PT_CONTROL_v1` en VS Code o en Codex.
2. Abre un terminal en esa carpeta y ejecuta:

```bash
npm ci
```

3. Crea un archivo **`.env.local`** junto a `package.json`, partiendo de `.env.example`:

```ini
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
```

4. Ejecuta:

```bash
npm run dev
```

5. Abre la dirección local que indique Vite, normalmente `http://localhost:5173/`, inicia sesión con el usuario creado en Supabase y registra un trabajo **de prueba**.
6. Comprueba en Supabase **Table Editor → trabajos** que el registro aparece y que, al recargar la web, sigue ahí. Añade un comentario y una ampliación; deben aparecer en sus tablas correspondientes.

Para ejecutar las pruebas: `npm test`. Para revisar compilación: `npm run build`.

## 4. Publicación en GitHub Pages (un repositorio nuevo)

El proyecto incluye `.github/workflows/deploy.yml` para publicar React/Vite automáticamente con GitHub Actions.

1. Crea un repositorio en GitHub, por ejemplo **`pt-control`**, y sube allí **el contenido** de esta carpeta, incluidos `.github`, `src`, `supabase`, etc. No subas `.env.local` ni copias de tus permisos. **El código puede ser público, pero los datos y claves secretas no.** Puedes usar repositorio privado si tus condiciones de GitHub Pages lo permiten.
2. En GitHub, abre **Settings → Secrets and variables → Actions → New repository secret** y crea dos secretos:
   - `VITE_SUPABASE_URL` = URL del proyecto.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = clave pública publishable (nunca service_role).
3. En **Settings → Pages**, selecciona **Build and deployment → Source: GitHub Actions**.
4. El workflow compila y publica al hacer push a `main`. La dirección será aproximadamente `https://TU-USUARIO.github.io/pt-control/`.
5. En Supabase, configura **Authentication → URL Configuration → Site URL** y **Redirect URLs** para la URL definitiva de tu aplicación si vas a utilizar enlaces de correo/invitación/recuperación de contraseña.

El workflow usa `npm ci`, ejecuta las pruebas y comprueba la configuración antes de compilar. Rechaza claves administrativas y configuración incompleta. La ruta base se calcula a partir del nombre del repositorio. La navegación entre vistas se mantiene dentro de la página y no necesita rutas SPA adicionales. Para un dominio propio o un repositorio `USUARIO.github.io`, ajusta la base del workflow a `/`.

> **Nota:** las variables `VITE_` quedan incluidas en el JavaScript servido al navegador. En Supabase, la clave **publishable/anon** está diseñada para ser pública. La verdadera protección de tus datos depende de **RLS + autenticación**. No confundas los secretos de Actions con una forma de esconder las variables VITE en el resultado publicado.

## 5. Copias de seguridad y recuperación

- **CSV Excel:** desde Registro, botón `CSV Excel`, exporta todos los trabajos (incluidos archivados) y sus números de ampliación, independientemente de los filtros visibles. Incluye BOM UTF-8, separador `;` y protección frente a fórmulas de Excel.
- **Copia JSON:** desde Registro, botón `Copia JSON`. Incluye las cuatro tablas y metadatos del registro. **No incluye contraseñas ni credenciales.** Es una exportación de datos, pero **v1 aún no tiene una herramienta de restauración automática desde ese JSON**.
- El plan gratuito de Supabase no ofrece las mismas opciones de backup y restauración de planes de pago. Para proteger tus datos realiza exportaciones periódicas y conserva los archivos en una ubicación privada y aprobada. Las copias descargadas contienen información que podría ser sensible.
- Para una copia completa restaurable de PostgreSQL se debe usar una estrategia de backups de base de datos adecuada, por ejemplo Supabase CLI `db dump`; consulta la documentación oficial.

## 6. Prueba mínima de seguridad

1. Abre la URL sin iniciar sesión: debe aparecer exclusivamente el formulario de acceso.
2. Después de iniciar sesión, crea y edita un trabajo.
3. Cierra sesión y recarga: no se deben mostrar registros.
4. En Supabase comprueba que las políticas de RLS están habilitadas y que `anon` no tiene permisos de tablas.
5. En GitHub comprueba que **NO** se ha subido `.env.local`, `service_role`, SQL con contraseñas, CSV/JSON reales o datos de la terminal.

## 7. Recomendaciones para evolucionar la app

- Importador de Excel con mapeo de columnas y detección de duplicados antes de aplicar cambios.
- Programación de un mismo trabajo en varias fechas sin sobrescribir jornadas históricas.
- Filtros y estadísticas por zona/empresa, adjuntos y exportación de informes PDF.
- Reglas configurables para caducidad de permisos y avisos de trabajos pendientes.

### Validación de esta revisión

- Dependencias instaladas y fijadas en `package-lock.json`; compilación de React/TypeScript/Vite comprobada.
- `npm test`: 17 pruebas (8 de dominio/configuración, 1 de base de datos y 8 de interfaz).
- PostgreSQL temporal mediante PGlite: ejecución de ambas migraciones, conservación de registros al aplicar `002`, relaciones, ampliaciones, historial de cambios simultáneos, archivo reversible, metadatos protegidos, denegación de acceso anónimo y aislamiento entre dos usuarios. El entorno de prueba reproduce `auth.uid()` y omite únicamente la instalación de `pgcrypto`, porque el motor ya incluye `gen_random_uuid()`.
- Interfaz mediante React Testing Library y un backend simulado solo en los tests: acceso privado, formularios, validación, guardado, errores sin falso éxito, filtros, calendario, ampliaciones y bloqueo de backups si falla la carga.
- Revisión visual en navegador de panel, registro, calendario y formulario con capturas estáticas de datos ficticios a resoluciones de escritorio y móvil. Estas capturas no prueban persistencia ni autenticación real.

**Puesta en marcha local comprobada:** Supabase configurado, ambas migraciones aplicadas y usuario personal creado con registro público desactivado. El propietario ha validado creación, persistencia al recargar, programación, estados, ampliaciones, comentarios, historial y archivo con un trabajo de prueba. Para una nueva instalación, sigue los pasos de configuración anteriores. Después del despliegue, comprueba el inicio de sesión desde la URL publicada y desde otro ordenador.

La sesión se conserva mediante Supabase Auth; los trabajos, ampliaciones, comentarios e historial se consultan y guardan exclusivamente en PostgreSQL. No se utiliza localStorage como base de datos de trabajos.

Consulta [REVISION.md](REVISION.md) para ver los archivos modificados y el orden de puesta en marcha. Referencias oficiales: [claves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys) y [seguridad RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Esta aplicación **no sustituye al sistema oficial de autorización, emisión o cierre de permisos de trabajo**.
