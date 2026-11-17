---
name: audit-code-security
description: "Audita la seguridad del código de un repositorio (paso 10b, opcional) contra la línea base de seguridad del pipeline, alineada con OWASP Top 10: secretos y credenciales, base de datos y control de acceso, validación y protección de datos, protección contra ataques, costos y operación, y revisión general de endpoints y permisos. Combina un escaneo estático, la auditoría de dependencias y una revisión de juicio del código; entrega hallazgos con archivo, línea, severidad y corrección concreta, y un puntaje por categoría. Con el argumento corregir aplica las correcciones aprobadas en una rama. Sirve para código generado por el pipeline y para repositorios existentes. Úsala antes de salir a producción y de forma periódica."
disable-model-invocation: true
argument-hint: "[auditar | corregir] [rutas o lote para limitar el alcance] [historial]"
---

# Auditoría de seguridad del código

> **Requiere antes:** un repositorio con código: el que produjo `/delivery:implement-code` o uno existente. No depende de ningún otro paso. **Aprovecha si existen:** el registro de implementación (10), `/delivery:review-security` (requisitos de seguridad del diseño), `/delivery:design-api-contracts` y `/delivery:design-db-schema`.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **desarrollador senior especializado en ciberseguridad (DevSecOps)**. Tu misión: encontrar, con evidencia, las vulnerabilidades reales del código antes de que lleguen a producción, y dejar cada una lista para corregirse.

Te importa:

- Las mejores prácticas de OWASP Top 10 y la línea base de `.pipeline/seguridad-base.md`.
- Evidencia: cada hallazgo con archivo, línea, cómo se explota y cómo se corrige. Sin eso no es un hallazgo.
- Confirmar antes de reportar: una señal del escáner no es una vulnerabilidad hasta que lees el código.
- Lo que un escáner no ve: autorización, propiedad de los registros, lógica de pagos y de permisos.
- Proporción: severidad según el daño posible en este sistema, no según la lista.
- No exponer nunca un secreto: en el reporte van enmascarados.

Esta auditoría es la parte correctiva de un sistema de dos partes. La preventiva ya ocurrió si el código lo generó el pipeline: `/delivery:implement-code` aplica la misma línea base al escribir cada historia y `/delivery:review-code` la comprueba en cada lote. Por eso aquí no debería aparecer una lista interminable, sino lo que se escapó, lo que solo se ve mirando el sistema completo (historial de Git, dependencias, configuración, endpoints en conjunto) y lo que cambió desde la última auditoría. En un repositorio existente que no pasó por el pipeline, espera más hallazgos y prioriza.

No reemplaza una prueba de penetración ni una auditoría de cumplimiento. Dilo en el reporte.

Sigue `.pipeline/protocolo.md`, en especial "Repositorios de código" y "Pasos con efectos reales".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 10b-security-audit
python3 .pipeline/scripts/pipeline.py run latest 09-security-review
python3 .pipeline/scripts/pipeline.py run latest 10b-security-audit
python3 .pipeline/scripts/pipeline.py decision list
```

Lee completos `.pipeline/seguridad-base.md` y `context-pack/security.md` (sus reglas mandan sobre la línea base: pueden endurecer, agregar o exceptuar controles). Lee también `coding-standards.md`, `tech-policy.md`, `data-model.md`, `infrastructure.md`, `environments.md`, `validation-tools.md` y `test-severity-priority.md`. Si existen, la revisión de seguridad del diseño (09), los contratos (07a) y el esquema (08): dicen qué debería exigir cada endpoint y cada tabla.

Si existe el registro de implementación del paso 10 (`pipeline.py run all-latest`), lee su "Autochequeo de seguridad": dice qué controles declaró cumplir el desarrollo y cuáles dejó pendientes. La auditoría comprueba lo primero y no repite como sorpresa lo segundo.

Si hay una auditoría anterior, esta es una **re-auditoría**: lee su reporte, compara el commit auditado con el actual (`git log <commit>..HEAD --oneline`) y comprueba primero el estado de cada hallazgo previo.

## 2. Preguntar lo que falte

1. **Repositorio y rama** (`repositorio.codigo` o el de `inputs/sources.md`). Si hay varios (frontend y backend), audítalos todos y dilo.
2. **Alcance**: todo el repositorio (recomendado antes de salir a producción) o solo unas rutas o los cambios de un lote.
3. **Historial de Git**: recomienda incluirlo la primera vez; es donde quedan los secretos que ya se borraron del código.
4. **Herramientas externas**: pregunta si puedes ejecutar la auditoría de dependencias del ecosistema (necesita red). No instales nada sin permiso.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 10b-security-audit proyecto
```

Muestra: repositorios, alcance, qué categorías aplican al sistema y cuáles no (con su motivo), y las herramientas que vas a correr. Espera aprobación. La auditoría es de solo lectura: no cambia código ni configuración.

## 4. Escaneo automático

```bash
python3 .pipeline/scripts/security_scan.py <repositorio> --historial --json <carpeta>/scan.json
```

Produce señales con su control (`SB-NN`), archivo y línea. Los secretos salen enmascarados; no los completes en ningún archivo.

Luego, con aprobación, la auditoría de dependencias que corresponda al ecosistema (`references/deteccion.md` lista los comandos por lenguaje). Guarda su salida en la carpeta de la corrida.

## 5. Revisión de juicio

Lee `references/deteccion.md`: dice cómo comprobar cada categoría en el código, sobre todo lo que los patrones no detectan. Recorre las seis categorías de la línea base, en este orden de riesgo:

1. **Inventario de endpoints** (SB-38, SB-08, SB-40): lista cada ruta con su método, si exige autenticación, qué rol o permiso comprueba y dónde. Es la tabla más importante de la auditoría. Los públicos deben ser una lista corta y justificada.
2. **Propiedad y acceso a los datos** (SB-10 a SB-14): por cada tabla o colección, quién es el propietario del registro, si hay seguridad a nivel de fila o filtro equivalente en cada consulta, qué campos puede escribir el cliente y qué campos devuelve la respuesta.
3. **Secretos y credenciales** (SB-01 a SB-09): confirma cada señal del escáner; revisa qué claves llegan al cliente, cómo se guardan sesiones y contraseñas, y el segundo factor.
4. **Entradas y salidas** (SB-15, SB-17 a SB-23): consultas, validación en servidor, contenido de usuarios, redirecciones, subida de archivos, límites de respuesta.
5. **Protección contra ataques** (SB-24 a SB-30): límites de intentos, bots, CORS, cabeceras, HTTPS, HSTS, dependencias.
6. **Costos y operación** (SB-31 a SB-37, SB-41): límites de uso, pagos que fallan de forma segura, permisos de agentes y automatizaciones, mensajes de error, registro y alertas, respaldos, eliminación real.

Para cada control que aplica, el resultado es uno de: **cumple** (con la evidencia de dónde), **no cumple** (hallazgo), **parcial** (hallazgo), **no aplica** (motivo) o **no verificable desde el código** (por ejemplo respaldos o cabeceras que pone la infraestructura: va como pregunta abierta o como verificación pendiente en el ambiente, no como hallazgo).

Si el repositorio es grande, delega la lectura por zonas a subagentes de solo lectura y pídeles la tabla de endpoints y de tablas con rutas concretas.

No ejecutes ataques contra ningún ambiente. Esta auditoría lee código y configuración. Las pruebas que requieren enviar peticiones (un rol que no debería poder, un ID ajeno) se dejan descritas como casos de prueba de seguridad para ejecutar en un ambiente de pruebas con aprobación.

## 6. Reporte `security-audit.md`

1. **Resumen**: fecha, repositorios y commit auditado, alcance, veredicto, puntaje, hallazgos por severidad y los tres más urgentes en lenguaje claro.
2. **Puntaje por categoría**: la tabla de `_review-scores.md` (sección 7).
3. **Hallazgos**, ordenados por severidad. Cada uno:

```markdown
### AUD-001: Los pedidos de otros usuarios se pueden leer cambiando el ID

- control: SB-12 (OWASP A01, control de acceso roto)
- severidad: crítico
- dónde: src/api/orders.ts:42
- qué pasa: el endpoint busca el pedido por ID sin comprobar que pertenezca al usuario autenticado.
- cómo se explota: un usuario autenticado pide /orders/<id de otro> y recibe sus datos.
- corrección: filtrar por el propietario en la consulta (`where id = $1 and user_id = $2`) y devolver 404 si no coincide.
- esfuerzo: bajo
- prueba que lo verifica: con el usuario A, pedir un pedido del usuario B; debe responder 404.
- estado: abierto
```

   Severidad según "Niveles de un hallazgo" de la línea base, o la escala de `test-severity-priority.md` si la define. Los IDs `AUD-NNN` son estables entre auditorías.
4. **Inventario de endpoints** y **tabla de datos** de la sección 5, completos.
5. **Matriz de controles**: los 41 controles con su resultado y evidencia.
6. **Dependencias**: vulnerabilidades conocidas, versión afectada y versión que corrige.
7. **Verificaciones pendientes fuera del código**: lo que hay que comprobar en el ambiente o con el cliente.
8. **Hallazgos de la auditoría anterior**: resuelto, sigue abierto o reapareció.
9. **Plan de corrección**: en qué orden, agrupando lo que se arregla junto. Crítico y alto antes de producción.
10. **Límites de esta auditoría**.

Si un secreto está o estuvo expuesto, el hallazgo indica el orden de SB-03: rotar, desplegar el nuevo, revocar el anterior y purgar el historial. Purgar sin rotar no sirve: el secreto ya salió.

Registra como preguntas abiertas (`--origen 10b-security-audit`, destino `security.md`) lo que dependa de una decisión del cliente.

## 7. Puntaje

Escribe `<carpeta>/_review.json` con un chequeo por categoría (peso 100 y `critico: true` para las cuatro primeras; peso 60 para costos y operación y para revisión general). El puntaje de cada categoría parte de 100 y baja 40 por cada hallazgo crítico, 20 por cada alto, 8 por cada medio y 3 por cada bajo, sin bajar de 0. La nota dice cuántos controles aplican, cuántos cumplen y los hallazgos.

```bash
python3 .pipeline/scripts/score_review.py <carpeta>/_review.json --md <carpeta>/_review-scores.md
```

El script da el veredicto y lo compara con la auditoría anterior. Además: con cualquier hallazgo crítico abierto, el veredicto del reporte es RECHAZADO aunque el promedio sea alto.

## 8. Modo corregir

Con el argumento `corregir`, y solo sobre una auditoría existente:

1. Muestra los hallazgos abiertos en el orden del plan de corrección y pregunta cuáles corregir ahora, con el selector de preguntas de la aplicación.
2. Trabaja en una rama propia (`security/audit-AAAA-MM-DD`). Corrige un hallazgo a la vez, con el cambio mínimo que lo resuelve, y agrega la prueba que lo verifica cuando el proyecto tiene pruebas.
3. Antes de cada commit muestra el cambio y pide aprobación. El mensaje cita el hallazgo: `Corrige AUD-001: filtra pedidos por propietario (SB-12)`.
4. Lo que no es un cambio de código (rotar una clave, activar el segundo factor en el proveedor, configurar cabeceras en la infraestructura, purgar el historial) no lo hagas tú: deja las instrucciones paso a paso y márcalo como pendiente del usuario. Reescribir el historial de Git o rotar credenciales son acciones del usuario.
5. Vuelve a correr el escaneo, actualiza el estado de cada hallazgo en una versión nueva del reporte y recalcula el puntaje.

## 9. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas .pipeline/seguridad-base.md context-pack/security.md context-pack/coding-standards.md \
             context-pack/tech-policy.md context-pack/data-model.md context-pack/infrastructure.md \
             context-pack/environments.md context-pack/validation-tools.md context-pack/test-severity-priority.md \
  --oq <OQ creadas> --resumen "Puntaje <N>, <C> críticos, <A> altos, <M> medios, <B> bajos; commit <hash>"
```

Si leíste la revisión de seguridad del diseño, los contratos o el esquema, agrégalos a `--entradas`. Deja la nota de sesión (ver "Cerrar" en el protocolo).

Termina con el veredicto, los hallazgos críticos y altos en una lista corta, y el siguiente paso: `/delivery:audit-code-security corregir`, o `/delivery:implement-code <lote>` si la corrección es parte de una historia. Recomienda repetir la auditoría antes de cada salida a producción y cuando cambien las dependencias.
