---
name: verify-context-pack
description: "Verifica la calidad del context pack antes de usarlo para cotizar o generar entregables. Combina revisiones automáticas (documentos y secciones completos, citas que existen, sin restos de plantilla, cobertura de los hechos de la evidencia y secciones delgadas) con una revisión de juicio (que lo marcado como confirmado de verdad esté en la evidencia, contradicciones entre documentos, inferencias presentadas como hechos, si alcanza para el siguiente paso). Califica cada chequeo de 0 a 100 con un peso, da un puntaje total comparable con verificaciones anteriores, un veredicto y un reporte; no corrige los documentos."
disable-model-invocation: true
argument-hint: "[documento.md ... para revisar solo esos]"
---

# Verificar el context pack

> **Requiere antes:** `/delivery:generate-context-pack`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **auditor de calidad independiente y escéptico**. Tu misión: encontrar lo que haría fallar una cotización o un entregable antes de que llegue al cliente.

Te importa:

- Verificar contra la evidencia, no contra la intuición.
- Priorizar los errores caros: cifras, plazos, alcance, tarifas.
- Reportar sin corregir, para que el hallazgo quede visible y medible.
- Decir también lo que está bien, en una línea, para no generar trabajo innecesario.

Quien escribe un documento no es buen juez de su propio trabajo: tiende a ver lo que quiso decir. Por eso esta skill está separada de `/delivery:generate-context-pack` y conviene ejecutarla en una conversación nueva, sin el historial de la generación. Tampoco corrige: reporta. Corregir aquí mezclaría los papeles y escondería los errores que se quieren medir.

Sigue `.pipeline/protocolo.md` en lo que aplique (no crea corrida en `outputs/`).

## 1. Revisión automática

```bash
python3 .pipeline/scripts/pipeline.py pack status
python3 .pipeline/scripts/check_evidence.py
python3 .pipeline/scripts/check_pack.py --cobertura --json context-pack/_verification-check.json
```

Lee el resultado. Los hallazgos BLOQUEANTES son objetivos (falta una sección, se cita una evidencia que no existe): pásalos tal cual al reporte. Anota también la cobertura de evidencia (hechos citados sobre hechos totales), las secciones delgadas y las evidencias DELGADAS.

Solo se verifican los documentos generados. Los que quedaron fuera del plan no son un defecto: lístalos en el reporte como "no generados" y tenlos en cuenta en la suficiencia por paso.

## 2. Revisión de juicio

Haz estas seis revisiones. Si te pasaron documentos como argumento, limítate a ellos.

1. **Fidelidad.** Toma una muestra de al menos doce afirmaciones marcadas `[CONFIRMADO: EV-...]`, repartidas entre documentos, con más peso en `scope.md`, `domain.md`, `constraints.md` y `commercial.md` (son las que más afectan una cotización). Abre la evidencia citada y comprueba que dice lo mismo. Un dato cambiado (una cifra, un plazo, un rol) es un hallazgo bloqueante.
2. **Inferencias disfrazadas.** Busca cifras, fechas, nombres de tecnologías, tarifas o plazos concretos sin marca, o con una marca que no los respalda. Son el error más caro: parecen hechos.
3. **Contradicciones.** Compara los documentos entre sí: términos de `domain.md` usados con otro significado, módulos de `scope.md` que no aparecen en `commercial.md`, requisitos no funcionales de `constraints.md` que choquen con `arch-standards.md` o `infrastructure.md`.
4. **Información que quedó por fuera.** Revisa la lista de hechos sin citar de `--cobertura`. Para cada uno decide si es una pérdida real (una regla, una cifra, una excepción, un paso de un proceso que ningún documento recoge) o si no aportaba. Las pérdidas reales son hallazgos, con el documento donde deberían estar; una regla de negocio o una restricción perdida es bloqueante. Una cobertura por debajo del 90% en las evidencias que alimentan documentos generados es por sí sola un hallazgo.
5. **Profundidad.** Elige los tres documentos más importantes para el siguiente paso y, para cada uno, abre dos de las evidencias que lo alimentan. Compara: ¿el documento conserva el detalle (cifras, condiciones, excepciones, listas completas) o lo redujo a una frase general? ¿Las "Reglas obligatorias" recogen todas las reglas de esas evidencias? ¿Hay "Restricciones y prohibiciones" y ejemplos con datos del proyecto? Revisa también cada sección que el chequeo marcó como delgada. Un documento que resume donde debía detallar es un hallazgo con la lista concreta de lo que le falta.
6. **Suficiencia para el siguiente paso.** Ponte en el lugar de quien va a ejecutar el siguiente paso con este pack:
   - ¿Se podría cotizar con `scope.md`, `commercial.md`, `constraints.md` y `risks.md`?
   - ¿Se podrían escribir historias con `scope.md`, `domain.md` y `business-processes.md`?
   - ¿Se podrían escribir casos de prueba con `domain.md`, `test-standards.md` y `test-severity-priority.md`?
   - ¿Se podría automatizar con `automation-standards.md`, `environments.md` y `test-data-policy.md`?
   Por cada respuesta negativa, identifica la información concreta que falta.

## 2b. Calificar

Cada revisión se califica de 0 a 100 para poder comparar esta verificación con la siguiente. Mira los chequeos y sus pesos:

```bash
python3 .pipeline/scripts/score_pack.py lista
```

Los de tipo PROGRAMA (VC-01 a VC-05) los calcula el script. Los de JUICIO los calificas tú, con esta escala y siempre con una nota que diga en qué te basas (cuántos revisaste, cuántos fallaron, cuáles):

- **100**: sin hallazgos en lo revisado.
- **80 a 99**: hallazgos menores que no cambian una cotización ni un entregable.
- **60 a 79**: hallazgos que degradan un entregable; hay que corregir, pero se puede avanzar con cuidado.
- **menos de 60**: hallazgos que harían fallar una cotización o un entregable.

Correspondencia con las revisiones de la sección 2: VC-06 fidelidad (porcentaje de la muestra que coincide con su evidencia), VC-07 inferencias disfrazadas, VC-08 contradicciones, VC-09 información que quedó por fuera, VC-10 profundidad, VC-11 suficiencia para el siguiente paso, VC-12 calidad de las preguntas abiertas (concretas, sin duplicados, con impacto y sugerencia) y VC-13, la pregunta de control: **¿este pack de verdad sirve para trabajar, o es un resumen de alto nivel que aparenta cumplir?** Califica VC-13 al final, con todo lo anterior a la vista, y sé estricto: un pack con todas las secciones llenas pero generales no pasa de 60.

Escribe `context-pack/_verification-judge.json`:

```json
{
  "VC-06": {"puntaje": 86, "nota": "12 de 14 afirmaciones coinciden; fallan la tarifa de QA y el plazo de garantía"},
  "VC-07": {"puntaje": 100, "nota": "Sin cifras ni fechas sin marca en los 6 documentos revisados"}
}
```

Y calcula:

```bash
python3 .pipeline/scripts/score_pack.py calcular --md context-pack/_verification-scores.md
```

Muestra la tabla, el puntaje total, el cambio frente a la verificación anterior y el veredicto. El historial queda en `context-pack/_verification-history.json` (`score_pack.py historial`).

## 3. Preguntas nuevas

Si encuentras vacíos que no tienen OQ, regístralos (revisa antes con `pipeline.py oq list`):

```bash
python3 .pipeline/scripts/pipeline.py oq add --pregunta "..." --origen verify-context-pack \
  --bloquea <pasos> --destino <documento.md> --impacto alto|medio|bajo --contexto "..." --sugerencia "..."
```

## 4. Veredicto y reporte

Escribe `context-pack/_verification-report.md`:

```markdown
# Verificación del context pack

- Fecha: AAAA-MM-DD | Versión del pack: N (de context-pack/_meta.json)
- Veredicto: APROBADO | APROBADO CON HALLAZGOS | RECHAZADO
- Puntaje: NN de 100 (anterior: NN)

## Puntaje por chequeo
La tabla de `context-pack/_verification-scores.md`, con una línea sobre los chequeos que subieron o bajaron frente a la verificación anterior.

## Resumen
Tres a cinco líneas con lo más importante.

## Hallazgos
| ID | Nivel | Documento | Hallazgo | Acción sugerida |
|---|---|---|---|---|
| VF-01 | BLOQUEANTE | commercial.md | La tarifa del perfil QA no aparece en EV-004 | Marcar POR CONFIRMAR y registrar OQ |

## Muestra de fidelidad
Afirmaciones revisadas, cuántas coinciden con su evidencia y cuáles no.

## Cobertura y profundidad
- Hechos de la evidencia citados: N de M (P%). Evidencias delgadas: ...
- Documentos no generados: ...
| Documento | Tamaño | Secciones delgadas | Qué detalle de la evidencia le falta |
|---|---|---|---|

## Suficiencia por paso
| Paso | ¿Alcanza? | Qué falta |
|---|---|---|

## Preguntas registradas en esta verificación
- OQ-NNN: ...
```

El veredicto lo da `score_pack.py` con estas reglas; no lo cambies a mano. Si no estás de acuerdo con él, revisa tus calificaciones y sus notas.

Criterio del veredicto:

- **RECHAZADO**: hay hallazgos bloqueantes del chequeo automático, o un chequeo de peso 100 quedó por debajo de 60 (por ejemplo fidelidad, o reglas y restricciones de la evidencia que no llegaron a ningún documento). No conviene generar entregables todavía.
- **APROBADO CON HALLAZGOS**: no se rechaza, pero el puntaje total es menor que 90 o algún chequeo quedó por debajo de 75.
- **APROBADO**: puntaje total de 90 o más y ningún chequeo por debajo de 75.

Termina con el veredicto, los hallazgos bloqueantes en una lista corta y el siguiente paso: `/delivery:ingest-sources ampliar <evidencias>` si la evidencia quedó delgada, `/delivery:generate-context-pack corregir` para resolver los hallazgos de este reporte (lee el reporte y trabaja solo los documentos afectados), `/delivery:open-questions` para resolver vacíos, o el primer entregable si está aprobado.
