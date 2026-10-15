# Revisión de PT CONTROL · 15 de octubre de 2026

Se conserva el proyecto React/TypeScript/Vite original y sus cuatro tablas. No se han eliminado datos.

Actualización de puesta en marcha: el propietario ha aplicado ambas migraciones en Supabase, creado su usuario y validado el ciclo completo de un trabajo de prueba con persistencia real. Se prepara la publicación en el repositorio independiente `BorjaRejano/pt-control` mediante el workflow incluido. La configuración local y los datos de trabajo no se suben a GitHub.

## Cambios

| Archivos | Resultado |
| --- | --- |
| `src/App.tsx` | Cinco indicadores, finalizados de hoy visibles, filtros combinables y ordenación, recuperación de errores, recarga periódica, protección ante respuestas antiguas, gestión de foco del diálogo y cierre de sesión en el ordenador actual. |
| `src/domain.ts` | Clasificación del panel, fechas de Madrid, cálculo de días, validación y escape seguro de CSV, separados para comprobarlos. |
| `src/config.ts`, `src/lib.ts` | Validación de conexión y rechazo de claves administrativas; paginación con orden estable; horas del historial en Madrid. |
| `src/styles.css` | Cinco indicadores, filtros adaptables, paleta principal y reducción de animaciones según preferencias. |
| `supabase/migrations/002_integridad_historial.sql` | Conservación de datos; metadatos inmutables; historial de todos los campos cambiados en una edición; índices de usuario en tablas vinculadas. |
| `tests/domain.test.ts`, `tests/database.test.ts`, `tests/app.test.tsx`, `vitest.config.ts` | Pruebas de dominio, PostgreSQL/RLS e interfaz con datos ficticios. |
| `package.json`, `package-lock.json` | Dependencias reproducibles y comandos de prueba. |
| `.github/workflows/deploy.yml`, `scripts/check-config.mjs` | Instalación reproducible, pruebas y comprobación de variables públicas antes de desplegar. |
| `.gitignore`, `README.md`, `REVISION.md` | Exclusión de artefactos locales y documentación actualizada. |

## Ejecutar

Abre un terminal en esta carpeta:

```powershell
npm ci
npm run dev
```

Vite indica la dirección local. Sin configuración aparece una pantalla que explica que falta conectar Supabase; no hay guardados simulados en la aplicación.

## Conectar Supabase

1. En un proyecto nuevo, aplica `001_pt_control.sql` y después `002_integridad_historial.sql` desde el editor SQL. En un proyecto con `001` ya aplicada, ejecuta solo `002`. Conserva una copia de seguridad antes de modificar una instalación con información real.
2. Crea el usuario personal en Supabase Auth y desactiva nuevos registros públicos.
3. Copia `.env.example` a `.env.local` y sustituye únicamente la URL y la clave **publishable** (o `anon` heredada). No incluyas contraseñas ni claves administrativas.
4. Reinicia Vite, inicia sesión, crea un trabajo ficticio sin fecha ni número y recarga el navegador.
5. Programa ese trabajo, cambia su estado y añade una ampliación y un comentario. Comprueba los datos en Supabase y que el historial registra los cambios.
6. Comprueba con un segundo navegador/ordenador, y verifica que después de cerrar sesión no se pueden ver los registros.

## Pruebas y límites

```powershell
npm test
npm run build
```

17 pruebas automatizadas. El test PostgreSQL usa una base efímera que se destruye al terminar y dos identidades ficticias. Los tests de interfaz simulan las respuestas del backend. Ninguno necesita credenciales ni escribe en Supabase real.

Para generar capturas HTML estáticas de los componentes, solo durante revisión local:

```powershell
$env:PT_QA_EXPORT='1'
npm run test:ui
Remove-Item Env:PT_QA_EXPORT
```

Se generan en `.qa/`, excluida de Git, con una etiqueta visible de prueba. No contienen lógica de guardado y no se incluyen en `dist`.

El propietario ha validado la conexión real con Supabase en local. El workflow de Pages comprueba las pruebas y compila antes de publicar; la comprobación final incluye abrir la URL publicada y acceder con el usuario personal. El calendario mensual, arrastrar y soltar, importación Excel y restauración JSON siguen fuera de esta versión, como se indicaba en la base original.
