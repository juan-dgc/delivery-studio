# Delivery Studio

Servidor local + interfaz HTML para ejecutar las skills del plugin `delivery` con tu suscripción de Claude (Agent SDK). Uso personal.

## Requisitos
Node 18+ y Python 3.8+ (se revisan al arrancar).

## Uso (un paso)
Mac: doble clic en `iniciar.command`. En cualquier sistema: `npm start`.

La primera vez, el arranque:
1. Instala las dependencias solo.
2. Usa el plugin que viaja dentro de esta carpeta (`plugin/delivery`). Si falta, lo busca en Documents, Desktop y Downloads, o te pide la carpeta, y lo copia aquí. Para refrescar la copia cuando cambies las skills: `npm run actualizar-plugin`.
3. Te deja elegir o crear la carpeta del cliente. Las siguientes veces ofrece continuar con la última.
4. Arranca el servidor y abre la interfaz. Si no hay sesión de Claude, pulsa "Iniciar sesión" en la interfaz.

Si el servidor ya está abierto, el arranque no falla: lo reconoce y decide solo.
- Mismo proyecto y mismo código: abre la interfaz sin reiniciar.
- Código nuevo u otro proyecto, sin ejecuciones trabajando: lo reinicia y abre la interfaz.
- Con ejecuciones trabajando: no lo reinicia (abre la interfaz tal cual; si pediste otro proyecto, te pide esperar).
- Puerto ocupado por otro programa: avisa y sugiere `--port <otro>`.
Para forzar un reinicio: `npm start -- --reiniciar`. El token de la sesión queda en `.delivery-token` (solo lo lee tu usuario); no lo compartas al comprimir la carpeta.

Para llevarlo a otro equipo, comprime la carpeta completa (sin `node_modules`) y repite el arranque.

## Rutas, etapas y aprobación
- Al abrir un proyecto eliges una ruta. Solo se muestra la ruta elegida; puedes abrir más rutas en pestañas, empezar desde cualquier paso o armar la tuya.
- Cada skill termina con la respuesta de Claude. Cuando estés conforme, pulsa **Aprobar etapa**: solo entonces se desbloquean las skills que dependen de ella (si además cumplen sus requisitos).
- Puedes tener hasta 3 skills trabajando a la vez, de skills distintas.

Opcional: `npm run doctor` diagnostica Node, Python, plugin y sesión si algo falla.

Pestañas: Rutas, Ejecución, Documentos, Insumos.

## Seguridad
- Escucha solo en 127.0.0.1, token aleatorio por arranque, verificación de Host y Origin.
- Modo suscripción: se eliminan ANTHROPIC_API_KEY y variables de Bedrock/Vertex para no cobrar por API. Con `--api-key` se usa la API.
- Escrituras solo dentro del proyecto; comandos riesgosos (git push, rm -rf, sudo) siempre preguntan.

## Política
Anthropic indica que el login de claude.ai en productos sobre el SDK requiere aprobación para terceros. Úsalo solo tú. Para compartirlo, cada persona debería usar su propia API key o pedir aprobación.

## Verificado y pendiente
Probado: estado y orden de pasos, política de permisos (27 pruebas con `node scripts/selftest.mjs`), visor, importación, interfaz en Chrome headless. No probado: ejecución real de skills, preguntas interactivas del modelo y permisos con sesión real.
