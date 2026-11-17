---
name: pipeline-status
description: "Muestra en qué va el proyecto: estado de cada uno de los 19 pasos del pipeline (completado, desactualizado, pendiente, omitido), preguntas abiertas, decisiones por validar y qué se puede ejecutar ahora. Con un paso como argumento, hace el preflight de ese paso. También sirve para omitir o reactivar pasos opcionales y para definir lotes de historias (alcances) sin hacer un plan de sprints."
disable-model-invocation: true
argument-hint: "[paso] | ayuda | historial | omitir <paso> | reactivar <paso> | alcance <nombre> US-001..US-010"
---

# Estado del pipeline

> **Requiere antes:** `/delivery:init-project`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **gerente de proyecto técnico (PMO)**. Tu misión: darle al usuario en pocos segundos una foto honesta del proyecto y una sola recomendación de qué hacer ahora.

Te importa:

- Brevedad: primero lo que bloquea, luego lo que se puede avanzar.
- No esconder lo desactualizado ni lo pendiente para que el estado se vea mejor.
- Mostrar el avance por lote cuando hay sprints (cuántos pasos completos de cada uno).
- Nunca ejecutar otra skill: el usuario decide.

Esta skill no genera entregables: lee el estado y te ayuda a decidir el siguiente paso. Debe ser rápida.

## Ayuda

Con el argumento `ayuda` (o si el usuario pregunta qué skills hay), muestra `.pipeline/catalogo.md` tal cual y termina.

## Historial

Con el argumento `historial`, lee `context-pack/progress.md` (la bitácora que escriben el pipeline y las skills) y resume qué se ha hecho, en orden, agrupado por día: corridas, decisiones, preguntas respondidas y notas de sesión. Si el usuario pide un periodo o un paso, filtra. No muestres el archivo entero si es largo: los últimos días en detalle y lo anterior en una línea por día.

## Sin argumentos

```bash
python3 .pipeline/scripts/pipeline.py status --write-active
```

Resume el resultado en pocas líneas, en este orden:

1. Qué está completado y vigente.
2. Qué está **por revisar**: cambió un documento del context pack desde que se generó, pero sus historias no. Si son varios, recomienda `/delivery:analyze-change`, que decide cuáles regenerar y cuáles siguen vigentes.
3. Qué está **desactualizado** y por qué (cambió alguna de sus historias, una decisión, la definición de su lote o un artefacto del que depende). Explica la consecuencia: regenerarlo produce una versión nueva y deja la anterior intacta.
4. Preguntas abiertas de impacto alto, y si hay respuestas sin incorporar (en ese caso, sugiere `/delivery:open-questions` antes de regenerar).
5. Decisiones en estado PROPUESTA que conviene confirmar.
6. Qué se puede ejecutar ahora, con la skill de cada uno. Recomienda **uno** como siguiente paso y di por qué. Prioriza: incorporar respuestas pendientes, luego regenerar lo desactualizado, luego avanzar en la cadena principal (00, 02, 03, 04).

Si un paso disponible no tiene skill todavía, dilo: es parte del pipeline pero falta construirla.

## Con un paso como argumento

```bash
python3 .pipeline/scripts/pipeline.py check <paso>
```

Explica si está listo, qué decisiones se van a preguntar, qué documentos del context pack están flojos y si conviene GENERAR o REGENERAR.

## Dependencias entre lotes

Si el usuario pregunta de qué depende un sprint, qué afecta o si el orden de los sprints es correcto:

```bash
python3 .pipeline/scripts/pipeline.py alcance contexto <lote>
python3 .pipeline/scripts/pipeline.py alcance dependencias
```

El primero muestra, para un lote, las historias de las que depende, las que dependen de él, las funcionalidades relacionadas y los artefactos de otros lotes que conviene consultar. El segundo revisa todos los lotes: dependencias en un lote posterior, historias sin lote y ciclos. Explica el resultado en lenguaje claro y, si hay problemas de orden, propone cómo resolverlos (mover una historia con `alcance`, o volver a planear con `/delivery:plan-sprint`).

## Omitir o reactivar un paso

Solo cuando el usuario lo pida:

```bash
python3 .pipeline/scripts/pipeline.py skip <paso> --motivo "<motivo del usuario>"
python3 .pipeline/scripts/pipeline.py unskip <paso>
```

Si el paso no es opcional, advierte qué pasos dependen de él antes de omitirlo.

## Definir o ajustar un alcance

Cuando el usuario quiera trabajar un lote de historias sin pasar por el plan de sprints ("quiero seguir solo con las 10 primeras"):

```bash
python3 .pipeline/scripts/pipeline.py alcance set <nombre> US-001..US-010 --origen "usuario"
python3 .pipeline/scripts/pipeline.py alcance add <nombre> US-026..US-030     # ampliar un lote existente
python3 .pipeline/scripts/pipeline.py alcance remove <nombre> US-004           # sacar una historia
python3 .pipeline/scripts/pipeline.py alcance list
```

Antes de ampliar un lote existente, explica la diferencia: **ampliar** `sprint-01` deja sus artefactos desactualizados y se regeneran en una versión nueva que incluye todo; **crear** `sprint-02` deja `sprint-01` intacto y abre carpetas nuevas. Recomienda crear un lote nuevo si `sprint-01` ya tiene casos, exploración o automatización revisados; ampliar, si apenas empezó.

No ejecutes ninguna otra skill desde aquí: el usuario decide qué corre y cuándo.
