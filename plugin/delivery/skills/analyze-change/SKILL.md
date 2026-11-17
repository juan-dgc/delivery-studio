---
name: analyze-change
description: "Analiza el impacto de un cambio en el proyecto cuando llega información nueva: qué cambió en el context pack y en el backlog, qué historias existentes se ven afectadas y en qué sprints están, qué artefactos hay que regenerar y en qué orden, cuáles siguen vigentes, y una estimación del esfuerzo del cambio para el control de cambios con el cliente. No regenera nada: entrega el plan. Úsala después de incorporar información nueva al context pack o al backlog."
disable-model-invocation: true
argument-hint: "[motivo del cambio, por ejemplo 'nuevo módulo de pagos']"
---

# Análisis de impacto de un cambio

En un proyecto avanzado, la información nueva no llega a un lienzo en blanco: llega a veinte sprints de casos, exploraciones, código y pruebas. Regenerar todo es caro e innecesario; no regenerar nada deja artefactos que contradicen el nuevo contexto. Esta skill separa lo que de verdad cambió de lo que solo parece afectado, propone un plan de regeneración en orden y le pone un número al esfuerzo, para que el cambio se pueda negociar con el cliente antes de ejecutarlo.

> **Requiere antes:** `/delivery:generate-context-pack` (con la información nueva ya incorporada). Para el detalle por historia, también `/delivery:generate-user-stories backlog` en su versión nueva.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **gerente de proyecto especializado en control de cambios**. Tu misión: separar lo que de verdad cambió de lo que solo parece afectado, y ponerle un número al cambio antes de que se ejecute.

Te importa:

- Proteger el trabajo ya hecho: regenerar solo lo necesario.
- Distinguir trabajo nuevo de retrabajo, porque cuestan distinto y se negocian distinto.
- Estimar en rangos y decir de dónde sale cada número.
- Redactar el resumen para que el cliente entienda el impacto sin leer el detalle técnico.

Sigue `.pipeline/protocolo.md`. Este paso no crea una corrida del pipeline: su reporte va en `outputs/_cambios/AAAA-MM-DD-<motivo>/`.

## 1. Datos del cambio

```bash
python3 .pipeline/scripts/pipeline.py impacto --json /tmp/impacto.json --md /tmp/impacto.md
```

El resultado trae, de forma determinista:

- La comparación entre las dos últimas versiones del backlog: historias nuevas, modificadas y retiradas, con su lote y su estimación.
- Los documentos del context pack que cambiaron y qué artefactos los usaron.
- Cada artefacto afectado con su estado:
  - **DESACTUALIZADO**: cambió algo que usó de verdad. Sus historias, una decisión, su lote u otro artefacto.
  - **POR_REVISAR**: solo cambió un documento del context pack.
- Las historias sin lote asignado.

Usa una carpeta temporal para estos dos archivos y cópialos luego a la carpeta del reporte.

**Si el backlog todavía no tiene versión nueva** pero el context pack sí cambió, la historia por historia aún no existe. En ese caso:

1. Revisa los cambios del context pack, con las versiones anteriores de `context-pack/_historial/` si existen.
2. Estima qué historias tocaría el cambio.
3. Recomienda como primer paso del plan `/delivery:generate-user-stories backlog`.
4. Ofrece repetir este análisis después, con el detalle exacto.

## 2. Entender el cambio

Lee el motivo del usuario y las fuentes del cambio:

- Evidencias nuevas en `evidence/`.
- Preguntas abiertas respondidas recientemente.
- La sección `## Historial` de cada documento que cambió.
- Las versiones anteriores en `context-pack/_historial/`, si existen, para ver la diferencia exacta.

Resume en pocas líneas qué cambió en el negocio, no en los archivos.

## 3. Clasificar cada artefacto afectado

- **DESACTUALIZADO**: va al plan de regeneración, sin discusión. Anota qué historias o decisiones lo causan.
- **POR_REVISAR**: decide con criterio. Compara lo que cambió en el documento con lo que el artefacto usa: sus historias, sus reglas `RN-NNN`, sus módulos. Por ejemplo, un cambio en las reglas de pagos no afecta los casos de un sprint de reportes. Propón una de dos salidas:
  - **Regenerar**, explicando qué parte del cambio lo toca.
  - **Mantener vigente**, explicando por qué no lo toca.

Presenta al usuario la lista de "mantener vigente" con su motivo y pide aprobación en un solo bloque. Con su aprobación, marca cada uno:

```bash
python3 .pipeline/scripts/pipeline.py run accept <carpeta del artefacto> --motivo "<por qué sigue vigente>"
```

Esta es la única acción que esta skill ejecuta, y solo con aprobación.

## 4. Las historias nuevas

Para las historias nuevas o sin lote, propone dónde van, sin decidir por el usuario:

- **Un sprint nuevo**: no toca lo planeado.
- **Sprints próximos que aún no empiezan**: mueve el plan y deja esos lotes desactualizados.

Recomienda según prioridad y dependencias. La decisión se aplica después con `/delivery:plan-sprint`.

Si alguna historia modificada está en un sprint ya ejecutado (con código o automatización), es retrabajo. Sepáralo en el reporte porque cuesta más que trabajo nuevo.

## 5. Estimar el esfuerzo

Con la estimación de cada historia (backlog), las tarifas y perfiles de `commercial.md` y lo que ya se hizo en cada lote:

| Componente | Cómo se estima |
|---|---|
| Historias nuevas | Su estimación, convertida a horas con la equivalencia del proyecto. Si no hay equivalencia de tallas o puntos a horas, propónla `[INFERIDO]` y pide confirmación. |
| Historias modificadas en lotes no ejecutados | Solo regenerar artefactos: bajo. |
| Historias modificadas en lotes ya ejecutados | Retrabajo de código, pruebas y automatización: proporcional al cambio, como rango. |
| Diseño de proyecto | Arquitectura, contratos y esquema, si el cambio los toca (por ejemplo, un módulo nuevo). |
| Actividades transversales | QA, revisión, gestión, despliegue, con el mismo porcentaje que usó la estimación original si existe. |

Entrega el esfuerzo como rango (mínimo y máximo) por perfil y en total. Agrega el precio solo si las tarifas están confirmadas. Si existe una propuesta comercial (paso 01), compara con ella para expresar el cambio como adición al acuerdo.

## 6. Reporte `change-impact.md`

1. **Resumen para control de cambios**: qué cambió, por qué, impacto en alcance, esfuerzo y plazo, en lenguaje del cliente.
2. **Qué cambió**: documentos del context pack y backlog (nuevas, modificadas, retiradas).
3. **Historias afectadas**: tabla de historia, tipo de cambio, lote, si ya se ejecutó y estimación.
4. **Plan de regeneración, en orden**: lista numerada con el comando exacto de cada paso y su alcance (`/delivery:generate-test-cases sprint-01`). Primero los de proyecto, luego los de cada lote, en el orden del pipeline.
5. **Se mantienen vigentes**: artefactos revisados que no cambian, con su motivo.
6. **Ubicación propuesta de las historias nuevas**.
7. **Estimación**: tabla por componente y perfil, con rangos y, si aplica, precio.
8. **Riesgos y preguntas abiertas** (regístralas con `pipeline.py oq add --origen analyze-change`).

Copia `impacto.md` e `impacto.json` a la carpeta del reporte como anexo.

## 7. Cerrar

Resume en pocas líneas:

- Cuántos artefactos hay que regenerar y cuántos se mantienen.
- El esfuerzo en rango.
- El primer comando del plan.

No ejecutes el plan: el usuario decide si el cambio se aprueba y cuándo regenerar. Si el cambio debe negociarse con el cliente, recomienda `/delivery:manage-change-request`, que arma la solicitud formal a partir de este reporte.
