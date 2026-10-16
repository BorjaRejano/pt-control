# Comprobación local contra Supabase · 16/10/2026

Prueba realizada desde http://localhost:5173/ con la sesión del usuario. Sin publicar en GitHub ni modificar permisos de trabajo reales.

Registro ficticio conservado para continuar: **PRUEBA FICTICIA QA-003 — ampliaciones y archivado**, número original `QA-003-ORIGINAL`. Una ampliación completa `QA-003-AMP-01`, fecha 18/11/2026. Estado finalizado, archivado.

## Resultados observados

- Crear trabajo: correcto.
- Crear ampliación completa: correcto; el número vigente pasa a QA-003-AMP-01 y se conserva el original.
- Crear ampliación sin número/fecha: rechazado por Supabase: `null value in column "numero_ampliacion" of relation "ampliaciones" violates not-null constraint`. No se creó una ampliación incompleta.
- Editar ampliación existente: rechazado: `permission denied for table ampliaciones`. Se conserva el número original de la ampliación, sin duplicados.
- Finalizar desde el registro: correcto. Después de recargar aparece en Archivados con su ampliación. El historial confirma «Trabajo archivado. Estado: pendiente → finalizado».
- Abrir el aviso de eliminación y cancelar: correcto; conserva el registro.
- Eliminación definitiva y comprobación de cascada en la base real: pendientes. No se ejecutó el borrado.

## Próximo paso

Los errores muestran que las modificaciones de la migración 003 actual no están presentes en la base que atiende a la app. Ejecutar el contenido completo de `supabase/migrations/003_planificacion_ampliaciones.sql` en el SQL Editor del proyecto configurado en la app y comprobar que termina correctamente. El script es transaccional y admite volver a ejecutarlo. Después repetir las pruebas pendientes sobre el mismo registro ficticio.

Se mejoró el diagnóstico local de errores para incluir el mensaje concreto de Supabase junto a la indicación de revisar la migración. Capturas en `.qa/migracion003-error-edicion.png` y `.qa/migracion003-archivado.png` (ignoradas por Git).

## Segunda comprobación tras comunicar Success en SQL Editor

- Se recargó la app y se utilizó exclusivamente el mismo permiso ficticio.
- Recuperar el permiso finalizado del archivo: correcto; vuelve a Pendiente.
- Editar QA-003-AMP-01: sigue rechazado con `permission denied for table ampliaciones`. No se guardó el sufijo EDITADA.
- Insertar una ampliación completamente pendiente: sigue rechazado por la restricción NOT NULL de numero_ampliacion. Continúa existiendo una sola ampliación.
- Finalizar desde la ficha y guardar: correcto. Después de recargar se conserva Finalizado y Archivado.
- Configuración local comprobada: VITE_SUPABASE_URL apunta al proyecto uxhltqypmxgnkkwhrmpp.
- Se preparó `supabase/comprobar_migracion_003.sql`, consulta de solo lectura para comprobar nulabilidad, privilegios, políticas y trigger antes de proponer otra modificación.
- Borrado definitivo preparado en el aviso de confirmación, pendiente de confirmación del usuario exigida por la herramienta de navegador para la acción irreversible. No se ejecutó.
- Evidencias nuevas: `.qa/migracion003-segunda-prueba-error.png` y `.qa/migracion003-confirmar-borrado.png`.

## Intento de borrado autorizado por el usuario

El usuario confirmó expresamente eliminar solo el permiso ficticio QA-003 con su ampliación e historial. Se pulsó «Eliminar definitivamente» sobre ese registro. Supabase rechazó la operación: `permission denied for table trabajos`.

Después de cancelar el aviso, recargar y buscar QA-003 en Archivados, el permiso sigue presente con QA-003-AMP-01 y una ampliación. **No se ha eliminado**. La autorización del usuario para borrar este registro se conserva; el bloqueo actual es el permiso DELETE de Supabase. Pendiente obtener el resultado de `supabase/comprobar_migracion_003.sql`. Evidencia: `.qa/migracion003-borrado-denegado.png`.

## Borrado completado tras corregir permisos

Tras ejecutar el usuario el GRANT DELETE y la política de eliminación propia, los tres valores del diagnóstico de borrado son true. Se volvió a pulsar «Eliminar definitivamente» exclusivamente sobre PRUEBA FICTICIA QA-003 — ampliaciones y archivado (QA-003-AMP-01). La app confirmó «Permiso eliminado».

Se recargó la página y se comprobó la búsqueda QA-003 en Archivados: cero registros. También en Registro, con «Incluir archivados» activado: cero registros. El permiso no reaparece. Evidencia: `.qa/migracion003-borrado-verificado.png`. El borrado de relaciones depende de las FK en cascada existentes; no se inspeccionaron por separado las tablas de relaciones en Supabase durante este intento. Los errores pendientes de edición y ampliaciones incompletas requieren su propia corrección; este resultado solo confirma el borrado del trabajo y su ausencia persistente en la app.

## Ampliación pendiente y edición verificadas tras la corrección SQL

Se creó exclusivamente el nuevo trabajo ficticio **PRUEBA FICTICIA QA-003B — completar ampliación pendiente**, número original QA-003B-ORIGINAL, empresa PRUEBA FICTICIA.

- Crear una ampliación sin número ni fecha: correcto. Aparecen ambos avisos de datos pendientes y el contador indica una ampliación.
- Recargar antes de completar: conserva ambos campos vacíos y las observaciones, con una sola ampliación.
- Editar esa ampliación y guardar QA-003B-AMPLIADO, fecha 20/10/2026 y nuevas observaciones: correcto, mensaje «Ampliación actualizada».
- Recargar después de completar: mantiene el número y fecha nuevos como vigentes, conserva el número original y muestra exactamente una ampliación, sin avisos pendientes.
- El historial registra una creación con número/fecha pendientes y una modificación con los valores nuevos y anteriores. No existe una segunda ampliación.

Resultado: creación incompleta, edición y persistencia verificadas contra Supabase desde la app local. Evidencia: `.qa/ampliacion-completada-sin-duplicar.png`. Se conserva QA-003B para que el usuario pueda revisarlo; no se ha solicitado ni ejecutado su eliminación. No se modificaron trabajos reales ni se publicó en GitHub.

## Cierre de QA-003B

Posteriormente el usuario autorizó y confirmó el borrado definitivo de QA-003B. La app respondió «Permiso eliminado». Tras recargar, la búsqueda QA-003B en Registro con «Incluir archivados» activado mostró cero resultados. El permiso de prueba ya no se conserva. Evidencia local: `.qa/qa003b-borrado-verificado.png`. La comprobación visual confirma la ausencia persistente del trabajo; las tablas relacionadas no se inspeccionaron individualmente en Supabase.
