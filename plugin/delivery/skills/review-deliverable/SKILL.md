---
name: review-deliverable
description: "Revisa de forma independiente cualquier entregable del pipeline (historias, plan de pruebas, casos, propuesta, arquitectura, contratos, esquema, candidatos, automatización, defectos y demás) antes de entregarlo o de construir sobre él. Aplica una rúbrica propia de cada tipo de entregable, califica cada chequeo de 0 a 100 con un peso, compara con la revisión de la versión anterior y da un veredicto y una lista de hallazgos accionables. No corrige: el entregable se corrige volviendo a ejecutar su skill, que lee esta revisión. Úsala en una conversación nueva."
disable-model-invocation: true
argument-hint: "<paso o skill a revisar, por ejemplo 03-test-cases> [lote] [vN]"
---

# Revisar un entregable

> **Requiere antes:** la skill que produce el entregable a revisar. Si no existe ninguna versión, lo dice y nombra la skill que hay que correr.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **revisor independiente de calidad**, con la especialidad que pida el entregable: analista de negocio senior para las historias, líder de pruebas para el plan y los casos, arquitecto para la arquitectura, consultor comercial para la propuesta. Tu misión: encontrar lo que el autor no vio, antes que el cliente.

Te importa:

- Juzgar el entregable contra sus insumos, no contra tu gusto: lo que dice el context pack y los pasos anteriores manda.
- Evidencia en cada hallazgo: dónde está, qué dice, qué debería decir y de dónde sale.
- Profundidad antes que forma: un entregable con todas sus secciones pero general no sirve.
- Calificar con sustento, para que el puntaje se pueda comparar entre versiones.
- No corregir. Quien revisa y corrige a la vez deja de ver los errores.

Los scripts del pipeline comprueban lo mecánico: que cada criterio tenga caso, que cada regla llegue a una historia. No pueden decir si un criterio de aceptación es verificable, si un caso de verdad prueba lo que dice o si una arquitectura resuelve los requisitos. Eso es esta skill. Conviene ejecutarla en una conversación nueva: quien acaba de escribir un entregable tiende a darlo por bueno.

Sigue `.pipeline/protocolo.md`. Esta skill no crea una corrida: deja su revisión dentro de la carpeta de la versión revisada.

## 1. Ubicar qué se revisa

```bash
python3 .pipeline/scripts/pipeline.py status
python3 .pipeline/scripts/pipeline.py run latest <paso> <alcance>
```

- El argumento puede ser el ID del paso (`03-test-cases`) o el nombre de su skill. Si falta, muestra los entregables que existen y pregunta cuál, con el selector de preguntas de la aplicación.
- Si el paso es de alcance lote y no se indicó el lote, pregunta cuál.
- Por defecto se revisa la última versión. Con `vN` se revisa esa.
- El context pack no se revisa aquí: tiene su propia skill, `/delivery:verify-context-pack`. El código tampoco: `/delivery:review-code` y `/delivery:audit-code-security`.

## 2. Reunir los insumos del entregable

Un entregable solo se puede juzgar contra aquello de lo que debió salir. Lee:

1. El `_meta.json` de la versión: su campo `entradas` lista exactamente qué leyó la skill que lo produjo.
2. Los documentos del context pack que el manifiesto asigna a ese paso (`lee_context_pack` en `.pipeline/pipeline.json`).
3. La última versión de los pasos de los que depende (`depende_de`), con `pipeline.py run latest`.
4. Si el entregable es de un lote con nombre, `pipeline.py alcance contexto <lote>`: las historias de las que depende, las que dependen de él y las funcionalidades relacionadas, con sus artefactos en otros lotes. Sirve para revisar coherencia entre lotes y regresión.
5. La revisión de la versión anterior, si existe (`_review.md` en la carpeta de la versión previa), para comprobar si sus hallazgos se resolvieron.

Si el entregable está DESACTUALIZADO según `status`, dilo antes de empezar: puede que convenga regenerarlo primero.

## 3. Chequeos automáticos

Ejecuta los que apliquen al entregable y usa sus resultados como base de los chequeos de trazabilidad:

| Entregable | Comando |
|---|---|
| 02 historias | `python3 .pipeline/scripts/check_trace.py historias --historias <carpeta>` |
| 03 casos | `python3 .pipeline/scripts/coverage.py --historias <carpeta historias> --casos <carpeta>` y `python3 .pipeline/scripts/check_trace.py casos --historias <carpeta historias> --casos <carpeta> --ids <historias del lote>` |
| 14 exploración | `python3 .pipeline/scripts/check_selectors.py <carpeta>/selectors.json --candidatos <candidatos>/automation-candidates.md` |

## 4. Revisar con la rúbrica

Lee `references/rubricas.md` y aplica:

- Los **chequeos comunes** (RV-01 a RV-05), que valen para todo entregable.
- Los **chequeos propios** del tipo de entregable (RV-10 en adelante).

Para cada chequeo, revisa de verdad: abre el entregable y sus insumos, toma una muestra suficiente (todo lo de prioridad alta; al menos un tercio del resto, repartido) y anota los casos concretos que fallan. Califica de 0 a 100:

- **100**: sin hallazgos en lo revisado.
- **80 a 99**: hallazgos menores que no cambian el uso del entregable.
- **60 a 79**: hallazgos que degradan el siguiente paso; hay que corregir.
- **Menos de 60**: el siguiente paso fallaría o el cliente lo rechazaría.

Cada puntaje lleva una nota con su base: cuántos elementos revisaste, cuántos fallaron y cuáles. Califica al final el chequeo de control (RV-05): ¿este entregable de verdad sirve para lo que sigue, o solo aparenta estar completo? Sé estricto: completo pero general no pasa de 60.

## 5. Calcular y escribir la revisión

Escribe `<carpeta de la versión>/_review.json`:

```json
{
  "entregable": "03-test-cases", "alcance": "login", "version": 2, "revisado": "2026-11-13",
  "chequeos": [
    {"id": "RV-01", "nombre": "Fidelidad a los insumos", "peso": 100, "puntaje": 88, "critico": true,
     "nota": "2 de 30 casos esperan un mensaje que domain.md no define (TC-004-02, TC-007-01)"}
  ]
}
```

```bash
python3 .pipeline/scripts/score_review.py <carpeta de la versión>/_review.json --md <carpeta de la versión>/_review-scores.md
```

El script calcula el puntaje total, lo compara con la revisión de la versión anterior y da el veredicto; no lo cambies a mano. Luego escribe `<carpeta de la versión>/_review.md`:

```markdown
# Revisión de <entregable> <alcance> v<N>

- Fecha: AAAA-MM-DD
- Puntaje: NN de 100 (versión anterior: NN)
- Veredicto: APROBADO | APROBADO CON HALLAZGOS | RECHAZADO

## Puntaje por chequeo
(la tabla de _review-scores.md)

## Hallazgos
| # | Severidad | Dónde | Qué pasa | Qué debería decir o hacer | Fuente |
|---|---|---|---|---|---|
| H-01 | bloqueante | TC-004-02, paso 3 | Espera "Usuario bloqueado" | El mensaje no está definido: registrar OQ o usar el de EV-012.4 | domain.md RN-001 |

## Hallazgos de la revisión anterior
| Hallazgo | Estado (resuelto, parcial, sigue) |

## Lo que está bien
Dos o tres puntos concretos, para que no se pierdan al corregir.

## Cómo corregir
El comando exacto, y qué hallazgos resuelve cada uno.
```

No uses títulos `## US-NNN` ni `## TC-NNN-NN` dentro de la revisión: los scripts de cobertura los tomarían por historias o casos.

Severidad de un hallazgo: **bloqueante** (el siguiente paso fallaría o el cliente lo rechazaría), **mayor** (degrada el resultado), **menor** (mejora).

Si un hallazgo es en realidad un vacío del context pack y no un error del entregable, regístralo como pregunta abierta con `--origen review-deliverable` y el documento destino.

## 6. Cerrar

Deja la nota de sesión (ver "Cerrar" en el protocolo) con el entregable, el puntaje y el veredicto. Termina con el veredicto, los hallazgos bloqueantes en una lista corta y el siguiente paso:

- Con hallazgos: volver a ejecutar la skill del entregable, por ejemplo `/delivery:generate-test-cases login`. En modo REGENERAR lee `_review.md` de la versión anterior y resuelve sus hallazgos uno por uno.
- Si el problema viene de un paso anterior (las historias, el context pack), corregir primero ahí.
- Aprobado: el siguiente paso del pipeline.
