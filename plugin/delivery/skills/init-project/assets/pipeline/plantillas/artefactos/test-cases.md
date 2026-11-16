---
artefacto: casos de prueba
paso: 03-test-cases
alcance: <igual al de las historias>
version: <N>
modo: <GENERAR | REGENERAR>
historias_base: <outputs/02-user-stories/<alcance>/vN>
formato: <valor de la decisión pruebas.formato_casos>
fecha: <AAAA-MM-DD>
---

# Casos de prueba: <proyecto>, <alcance>

## Resumen

| Historia | Casos | Positivos | Negativos | Borde | Permisos | P1 | Pendientes |
|---|---|---|---|---|---|---|---|

## Cambios respecto a v<N-1>

<!-- Solo en REGENERAR: casos nuevos, modificados y retirados, con su motivo (OQ, cambio de historia). -->

## US-001: <título de la historia>

## TC-001-01: <qué se verifica, en una frase>

- cubre: US-001 (AC-001.1)
- reglas: RN-001 | ninguna
- procesos: PROC-01.2 | ninguno
- tipo: positivo | negativo | borde | permisos | e2e | no funcional
- prioridad: P1 | P2 | P3 | P4
- nivel: sistema | integración | aceptación
- precondiciones: <estado del sistema y del usuario antes de empezar>
- datos: <datos necesarios, según test-data-policy.md; nunca datos reales sensibles>
- automatizable: sí | no | por evaluar (preliminar; el paso 13 decide)
- fuente: [CONFIRMADO: ...] | [INFERIDO] | [POR CONFIRMAR: OQ-NNN]

| # | Paso | Resultado esperado |
|---|---|---|
| 1 | <acción concreta del usuario> | <resultado observable y verificable> |

## Sin caso

<!-- Reglas o pasos de proceso que una historia declara y que a propósito no tienen caso aquí, con su motivo: "- RN-012: se verifica en los casos de US-004". Quita la sección si no hay ninguno. -->

## Preguntas abiertas registradas en esta versión

- OQ-NNN: <pregunta> (afecta TC-00X-0Y)
