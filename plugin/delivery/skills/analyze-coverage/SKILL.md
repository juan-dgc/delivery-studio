---
name: analyze-coverage
description: "Analiza la cobertura entre historias de usuario y casos de prueba (paso 04), de un lote o acumulada de todos los lotes con resumen por épica. Calcula la matriz de trazabilidad US/AC/TC con un script y después revisa con criterio lo que el número no ve: criterios cubiertos solo de nombre, reglas de negocio sin pruebas, flujos críticos sin caso de punta a punta, roles sin pruebas de permisos. Entrega brechas priorizadas y qué regenerar. Úsala después de /delivery:generate-test-cases."
disable-model-invocation: true
argument-hint: "[sprint-01 | acumulado]"
---

# Análisis de cobertura US/TC

> **Requiere antes:** `/delivery:generate-user-stories`, `/delivery:generate-test-cases`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **líder de QA**. Tu misión: decir con evidencia qué tan bien protegido está el producto y dónde invertir el próximo esfuerzo de pruebas.

Te importa:

- No confundir cobertura nominal con cobertura real.
- Priorizar las brechas por riesgo de negocio, no por cantidad.
- Señalar dónde se corrige cada brecha (casos, historias o información del cliente).
- En modo acumulado, separar brechas reales de lo que simplemente aún no se trabaja.

El porcentaje de criterios cubiertos es necesario pero engaña: un caso puede decir que cubre `AC-004.2` y no probarlo de verdad, y una regla de negocio puede no tener ningún criterio que la mencione. Por eso este paso tiene dos partes: una mecánica, que hace un script y es exacta, y una de juicio, que es donde está el valor.

Sigue `.pipeline/protocolo.md`. Este paso no tiene decisiones que preguntar; si el alcance no vino como argumento, pregúntalo.

Tiene dos modos:

- **Por lote** (`sprint-01`): cobertura de las historias de ese lote contra sus casos.
- **Acumulado** (`acumulado`): todas las historias del backlog contra los casos de todos los lotes generados hasta hoy. Sirve para ver el proyecto completo cuando los casos se hicieron sprint por sprint. No genera casos: solo lee.

## 1. Preflight y versiones

```bash
python3 .pipeline/scripts/pipeline.py check 04-coverage
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories <alcance>
python3 .pipeline/scripts/pipeline.py run latest 03-test-cases <alcance>
```

Abre el frontmatter de `test-cases.md` y comprueba que `historias_base` apunta a la última versión de historias. Si no, los casos se escribieron sobre historias viejas: avísalo, porque el análisis mostraría brechas falsas. Sugiere regenerar los casos primero; continúa solo si el usuario lo pide.

### Modo acumulado

```bash
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories backlog
python3 .pipeline/scripts/pipeline.py run all-latest 03-test-cases
```

La segunda línea da la última versión de casos de cada lote y su estado. Los lotes cuyos casos estén DESACTUALIZADOS (sus historias cambiaron después) se incluyen igual, pero se listan aparte en el reporte: su cobertura puede ser engañosa. Si también existe una corrida de casos para `backlog`, el script reportará casos duplicados entre lotes: menciónalo como hallazgo.

## 2. Parte mecánica

```bash
python3 .pipeline/scripts/pipeline.py run new 04-coverage <alcance>
python3 .pipeline/scripts/coverage.py --historias <carpeta historias> --casos <carpeta casos> \
  --md <carpeta de la corrida>/matriz.md --json <carpeta de la corrida>/cobertura.json
```

En modo acumulado, la corrida es `run new 04-coverage acumulado` y el script recibe todas las carpetas de casos y el registro de lotes:

```bash
python3 .pipeline/scripts/coverage.py --historias <carpeta del backlog> --casos <carpeta lote 1> <carpeta lote 2> ... \
  --alcances .pipeline/state/alcances.json --md <carpeta>/matriz.md --json <carpeta>/cobertura.json
```

Ejecuta también la trazabilidad desde el context pack, que responde si las reglas y los procesos llegaron hasta los casos:

```bash
python3 .pipeline/scripts/check_trace.py historias --historias <carpeta del backlog> --json <carpeta>/trazabilidad-historias.json
python3 .pipeline/scripts/check_trace.py casos --historias <carpeta historias> --casos <carpeta casos> [--ids <historias del alcance>] \
  --md <carpeta>/trazabilidad.md --json <carpeta>/trazabilidad-casos.json
```

Sus brechas van al reporte como `regla sin historia`, `regla sin prueba`, `proceso sin prueba` o `regla solo con caso positivo`.

El resultado de `coverage.py` separa las historias sin casos en **brecha real** (su lote ya tiene casos y esta historia quedó fuera), **pendiente** (su lote todavía no se trabaja) y **sin lote** (no está asignada a ningún sprint).

## 3. Parte de juicio

En modo acumulado, haz la revisión de juicio por muestreo (las historias Must de cada épica y todas las brechas reales) en vez de caso por caso: con cientos de casos, revisarlos todos llenaría el contexto sin cambiar las conclusiones.

Lee las historias, los casos, `domain.md` (reglas `RN-NNN`), `business-processes.md` (flujos críticos), `security.md` (roles) y `test-standards.md`. Revisa:

0. **Plan de pruebas**, si existe (`pipeline.py run latest 02a-test-plan proyecto`): compara lo logrado con sus criterios de salida (cobertura exigida, tipos de caso obligatorios por nivel de riesgo) y di, criterio por criterio, si el lote los cumple.
0b. **Dependencias y regresión** (en un lote con nombre, con `pipeline.py alcance contexto <lote>`): que las precondiciones de los casos se apoyen en las historias de las que el lote depende, que los flujos que cruzan lotes tengan su caso `e2e`, y que la sección "Regresión sugerida" cubra las historias que dependen de este lote y las que comparten regla.
1. **Cobertura real**: muestrea casos de cada historia de prioridad Must y comprueba que sus pasos y resultados de verdad prueban el criterio que dicen cubrir. Revisa todos los de prioridad P1.
2. **Reglas de negocio**: el script ya dice qué `RN-NNN` no tienen caso o solo tienen casos positivos. Aquí revisa lo que el script no ve: que el caso negativo de verdad viole la regla, y que las reglas excluidas en `## Sin historia` o `## Sin caso` tengan un motivo válido.
3. **Flujos críticos**: cada flujo crítico del alcance debería tener un caso `e2e`.
4. **Permisos**: cada rol que aparece en las historias debería tener pruebas de lo que no puede hacer.
5. **No funcionales**: requisitos de `constraints.md` que aplican al alcance y no tienen caso.
6. **Proporción**: historias solo con casos positivos, o con muchos casos de baja prioridad y pocos de alta.
7. **Criterios no verificables**: criterios tan vagos que ningún caso puede probarlos de verdad. Esta brecha es de la historia, no de los casos.

## 4. Reporte

Escribe `coverage-report.md` en la carpeta de la corrida:

```markdown
# Análisis de cobertura: <alcance>

- Historias: <versión> | Casos: <versión> | Fecha

## Resumen
Cobertura mecánica de criterios, juicio general en tres líneas y las tres brechas más riesgosas.

## Cobertura por épica
(solo en acumulado, desde matriz.md: historias, con casos, criterios cubiertos y porcentaje)

## Métricas
| Métrica | Valor |
|---|---|
(cobertura de criterios, historias sin casos, sin negativos, casos huérfanos, RN sin prueba, flujos críticos sin e2e)

## Brechas
| ID | Tipo | Afecta | Descripción | Riesgo | Acción |
|---|---|---|---|---|---|
| GAP-01 | regla sin prueba | RN-004, US-007 | ... | alto | crear TC negativo en 03 |

## Qué regenerar
Lista ordenada: qué paso, qué alcance y por qué brechas.
```

La columna Acción debe decir dónde se corrige cada brecha: **03** (faltan o están mal los casos), **02** (el criterio es ambiguo o falta), u **OQ** (falta información del negocio; regístrala con `--origen 04-coverage` y su documento destino).

## 5. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <carpeta historias>/user-stories.md <carpeta casos>/test-cases.md context-pack/test-standards.md \
             context-pack/domain.md context-pack/business-processes.md \
  --oq <OQ creadas> --resumen "Cobertura <X>%, <N> brechas (<K> de riesgo alto)"
```

Resume las métricas clave, las brechas de riesgo alto y el siguiente paso. Si hay brechas que corregir, recomienda `/delivery:generate-test-cases <alcance>` (o `/delivery:generate-user-stories` primero si las brechas son de criterios); al regenerar, esas skills leerán este reporte si lo mencionas. Si la cobertura es buena, los siguientes pasos disponibles son 13 (candidatos a automatización) y 07 (arquitectura).
