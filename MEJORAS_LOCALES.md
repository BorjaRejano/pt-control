# Mejoras locales · 16 de octubre de 2026

Esta revisión se desarrolla únicamente en local. No se ha subido ni desplegado en GitHub. Mantiene React/TypeScript/Vite, las cuatro tablas existentes y la autenticación de Supabase; no añade dependencias.

## Comportamiento

1. Panel: se conserva Trabajos de hoy y los cinco indicadores. Después aparecen Próximos trabajos, Permisos sin programar y, si hay resultados, Trabajos con fecha anterior aún abiertos.
2. Finalizar guarda `estado=finalizado` y `archivado=true` en la misma actualización. La migración garantiza ese comportamiento también en PostgreSQL y archiva los finalizados anteriores. Los finalizados se consultan en Archivados y se pueden reabrir como pendientes mediante la ficha.
3. `permitInfo`, en `src/domain.ts`, centraliza número, fecha, ampliaciones y avisos. La última ampliación se determina por su fecha/hora de registro (`created_at`), no por una fecha de ejecución que puede estar pendiente. Editarla no modifica su posición en el historial. A igualdad de alta, se desempata por fecha e ID.
4. Si falta un dato de la última ampliación, se usa el último valor conocido de ampliaciones anteriores o del permiso original, marcado como referencia y con aviso específico. Si no se conoce ninguna fecha, el permiso permanece sin programar. Los datos pendientes de ampliaciones anteriores tampoco se ocultan.
5. Tarjetas y registro permiten cambiar el estado sin abrir la ficha. «Ampliado…» abre un formulario y no se guarda como un quinto estado. Cancelarlo no escribe datos ni modifica el estado. El botón Completar ampliación abre una ampliación pendiente; el historial permite editar cualquiera.
6. Número y fecha de ampliación son opcionales. Las ampliaciones incompletas reciben fondo rojizo y avisos textuales. Completar una existente utiliza UPDATE; no crea otra fila.
7. Eliminar está disponible en tarjetas, registro, archivo y ficha, con confirmación que identifica el permiso y advierte que se borrarán también ampliaciones, comentarios e historial. Solo se elimina después de confirmar. Las FK existentes mantienen la cascada sin huérfanos.
8. La cabecera y la navegación forman una barra sticky; los diálogos quedan por encima y retienen el foco. Se comprueba escritorio y móvil.
9. Próximos trabajos muestra todas las fechas vigentes o de referencia posteriores a hoy, ordenadas por fecha, para permisos pendientes, emitidos o con ampliaciones. Incluye fines de semana y fechas posteriores al siguiente día laboral; excluye archivados y finalizados. Los trabajos en ejecución solo aparecen en próximos si tienen ampliaciones. Las fechas visibles incluyen el año para distinguir trabajos de años anteriores.
10. El calendario muestra dos semanas consecutivas, de lunes a domingo, con número y año ISO. Parte de la semana actual, permite avanzar/retroceder una semana y volver con Hoy. Muestra cada permiso activo una sola vez en la fecha vigente o de referencia. En móvil, cada semana tiene desplazamiento horizontal propio.
11. Registro, archivo y CSV comparten `filterWorks`. CSV recibe todos los resultados filtrados y ordenados, sin limitarse a filas visibles. No hay paginación visual; `fetchAll` sigue recuperando todas las páginas de la API. Incluye BOM UTF-8, separador punto y coma, fechas DD/MM/AAAA, encabezados españoles y protección frente a fórmulas de Excel. Incluye referencias originales, ampliaciones y avisos. La copia JSON continúa siendo completa, independiente de los filtros.
12. Atrasados exige trabajo activo, no finalizado, con fecha vigente anterior a hoy. No existe fecha de vencimiento separada: se usa la programada o la última fecha conocida de ampliación. Una ampliación a hoy/futuro lo retira de atrasados; una posterior pendiente conserva la referencia y los avisos. Los días se comparan en formato calendario y el día actual se obtiene en Europe/Madrid.

## Paso manual necesario: migración 003

La migración está preparada y comprobada en PostgreSQL temporal. En el proyecto Supabase real se aplicaron las correcciones SQL de campos opcionales, edición, historial y borrado; las operaciones se validaron con trabajos ficticios. Consulta `VALIDACION_003.md`. Para otras instalaciones, sigue estos pasos:

1. Guarda una copia JSON completa desde la aplicación. Si dispones de un backup de base de datos, consérvalo también.
2. Abre el proyecto de Supabase y entra en SQL Editor → New query.
3. Copia y ejecuta **solo** `supabase/migrations/003_planificacion_ampliaciones.sql`, siempre después de haber aplicado 001 y 002. No vuelvas a ejecutar las migraciones iniciales.
4. Comprueba que no hay errores. La 003 conserva tablas y registros; admite su reaplicación. Actualiza las políticas y permisos de edición de ampliaciones/eliminación de trabajos, habilita campos pendientes y registra modificaciones en el historial.
5. Recarga `http://localhost:5173/`. Prueba con un permiso ficticio: ampliación vacía, edición de esa misma ampliación, finalizado/archivado y eliminación confirmada. No elimines registros reales durante la prueba.

Sin aplicar la 003, la interfaz podrá consultar los datos existentes, pero Supabase rechazará ampliaciones incompletas, edición de ampliaciones y eliminación. La app muestra el error y no comunica un éxito ficticio.

## Comprobaciones

- `npm run build`: TypeScript y compilación de producción.
- `npm test`: pruebas de dominio, configuración, PostgreSQL/RLS e interfaz simulada. Se comprueban fechas de Madrid, fin de semana, semanas ISO, referencias pendientes, varios números y fechas, archivado tras nueva carga, CSV filtrado con más de 500 resultados, errores de guardado, cancelación sin cambios, edición sin duplicados, confirmación y borrado de activos/archivados, reapertura y ventanas anidadas.
- La prueba PostgreSQL aplica 001, 002 y 003; aplica 003 de nuevo para verificar que no destruye datos; comprueba avisos de datos nulos a nivel de esquema, auditoría, archivo automático, integridad de metadatos, denegación a otro usuario/anónimo y eliminación en cascada.
- Revisión visual de las vistas HTML de prueba con datos ficticios, escritorio y móvil. Se verifica la barra sticky al desplazarse y la ausencia de desbordamiento horizontal general.
- Se probaron escrituras contra Supabase real exclusivamente con los permisos ficticios QA-003 y QA-003B: creación, ampliación vacía, edición sin duplicados, persistencia, archivado, recuperación y eliminación. No se modificaron trabajos reales.

## Archivos principales

- `src/App.tsx`: sesión, carga, mutaciones confirmadas y composición de vistas.
- `src/domain.ts`: reglas de fechas, ampliaciones, archivado, filtros y CSV.
- `src/WorkViews.tsx`: tarjetas, estados rápidos, registro y dos semanas.
- `src/WorkDetail.tsx`: ficha, ampliaciones editables y comentarios.
- `src/Modal.tsx`: ventanas, foco y bloqueo de scroll con anidamiento.
- `src/AuthScreens.tsx`, `src/errors.ts`, `src/lib.ts`: acceso, errores y tipos adaptados.
- `src/styles.css`: se mantiene el diseño existente, bordes y fondos por estado; se añaden avisos y controles responsive.
- `supabase/migrations/003_planificacion_ampliaciones.sql` y los tres archivos de pruebas en `tests/`.

Ejecutar en esta carpeta: `npm ci` si es necesario y `npm run dev`. Las vistas `.qa/` son capturas estáticas generadas por las pruebas, no la aplicación interactiva. Utiliza la raíz de localhost para trabajar.

## Corrección de fechas autorizada el 16 de octubre de 2026

El usuario confirmó que las fechas de 2016 debían ser de 2026. Se corrigieron cinco fechas originales desde la interfaz, conservando día, mes y estado: una del 13/10, dos del 15/10 y dos del 14/11. Otras seis fechas de noviembre ya constaban como 2026 al iniciar esta revisión. Las dos fechas de ampliaciones existentes también eran de 2026.

Tras recargar, el registro completo mostró 18 permisos y ninguna fecha vigente de 2016. El panel local, con la nueva clasificación, mostró 3 atrasados (15/10/2026), 2 de hoy (16/10/2026), 8 próximos (noviembre de 2026), 4 sin fecha y 1 finalizado conservado en Archivados. Evidencia local ignorada por Git: `.qa/panel-fechas-2026-verificado.png`. Los cambios de datos se guardaron en Supabase; las modificaciones de código de esta revisión siguen locales.
