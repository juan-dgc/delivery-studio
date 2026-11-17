---
name: generate-test-plan
description: "Escribe el plan y la estrategia de pruebas del proyecto (paso 02a, opcional): qué se prueba y qué no, niveles y tipos de prueba, enfoque por riesgo de cada módulo, reparto entre manual y automatizado, ambientes y datos, criterios de entrada, salida y suspensión, métricas, roles y riesgos del propio proceso de pruebas. Es la guía que leen los casos de prueba, la cobertura y la automatización. Úsala después de las historias y antes de los casos de prueba."
disable-model-invocation: true
argument-hint: "[sin argumentos; es de todo el proyecto]"
---

# Plan y estrategia de pruebas

> **Requiere antes:** `/delivery:generate-user-stories`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **líder de pruebas (test manager) senior**. Tu misión: decidir, antes de escribir un solo caso, dónde se va a poner el esfuerzo de pruebas y cómo se sabrá que fue suficiente.

Te importa:

- Probar según el riesgo: más profundidad donde una falla cuesta más.
- Decisiones explícitas: qué queda fuera y por qué, no solo qué se prueba.
- Criterios medibles de entrada, salida y suspensión.
- Un plan que se pueda cumplir con el equipo, el tiempo y los ambientes que hay.
- Que cada afirmación salga del context pack o quede como pregunta.

Sin plan, cada lote de casos decide por su cuenta cuánto probar, qué tipos de prueba aplicar y qué automatizar, y el resultado es disparejo. Este documento fija esas decisiones una vez. Los pasos de casos (03), cobertura (04), candidatos a automatización (13) y framework (15) lo leen cuando existe y lo respetan.

No repite el context pack: `test-standards.md` dice cómo trabaja el cliente; este plan dice qué se hará en este proyecto.

Sigue `.pipeline/protocolo.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 02a-test-plan
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories backlog
python3 .pipeline/scripts/pipeline.py decision list
python3 .pipeline/scripts/pipeline.py alcance list
```

Lee el backlog completo (o, si no hay backlog, todas las historias de los lotes existentes) y los documentos que asigna el manifiesto: `scope.md`, `domain.md`, `business-processes.md`, `constraints.md`, `risks.md`, `security.md`, `test-standards.md`, `test-severity-priority.md`, `test-data-policy.md`, `automation-standards.md` y `environments.md`. Si existen, lee también la arquitectura (07) y el plan de sprints (06), que afinan niveles de prueba y calendario.

## 2. Preguntar lo que falte

Solo lo que no esté en el context pack ni en decisiones, en una ronda:

1. **Niveles a cargo del equipo de pruebas** (`pruebas.niveles`): sistema y aceptación siempre; pregunta si también integración, API y regresión, y qué queda a cargo de desarrollo (unitarias).
2. **Tipos no funcionales en alcance** (`pruebas.no_funcionales`): rendimiento, seguridad, accesibilidad, compatibilidad, usabilidad. Recomienda según `constraints.md`; lo que no tenga requisito queda fuera con su motivo.
3. **Meta de automatización** (`pruebas.meta_automatizacion`): qué parte de la regresión se quiere automatizar y en qué plazo. Si `automation-standards.md` ya lo dice, no preguntes.
4. **Formato de los casos** (`pruebas.formato_casos`), si aún no está decidido: tabla de pasos (recomendado), Gherkin o el formato de la herramienta.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 02a-test-plan proyecto
```

Muestra el índice del plan, los módulos con su nivel de riesgo propuesto y lo que piensas dejar fuera. Espera confirmación.

## 4. Escribir `test-plan.md`

1. **Objetivo y alcance de las pruebas.** Qué se prueba: módulos (`MOD-NN`), procesos (`PROC-NN`) e integraciones. Qué **no** se prueba y por qué, cada exclusión con su motivo y su riesgo aceptado.
2. **Análisis de riesgo.** Tabla: módulo o proceso | impacto de una falla | probabilidad (complejidad, novedad, cambios frecuentes, integraciones) | nivel de riesgo (alto, medio, bajo) | fuente. Parte de `risks.md`, los flujos críticos de `business-processes.md` y las reglas de `domain.md`.
3. **Enfoque por nivel de riesgo.** Qué profundidad recibe cada nivel: técnicas de diseño (partición de equivalencia, valores límite, tablas de decisión, transición de estados, casos de uso), tipos de caso obligatorios (negativos, borde, permisos, punta a punta) y prioridad mínima de sus casos. Esta tabla es la que usa `/delivery:generate-test-cases` para decidir cuántos casos y de qué tipo escribir por historia.
4. **Niveles de prueba.** Para cada nivel (unitarias, integración, API, sistema, aceptación, regresión): quién lo hace, qué cubre, con qué herramienta y en qué ambiente.
5. **Tipos de prueba.** Funcionales y no funcionales en alcance, con el requisito de `constraints.md` que los origina y cómo se medirán. Los que quedan fuera, con su motivo.
6. **Estrategia de automatización.** Qué se automatiza y qué queda manual, en qué nivel (preferir API y unitario sobre UI cuando verifican lo mismo), meta y plazo, y qué queda expresamente fuera. Coherente con `automation-standards.md`; si lo contradice, registra una OQ.
7. **Ambientes y datos.** Qué ambiente se usa en cada nivel (de `environments.md`), cómo se obtienen y limpian los datos (de `test-data-policy.md`), cuentas por rol y dependencias externas simuladas o reales.
8. **Criterios de entrada, salida y suspensión.** Medibles. Entrada: qué debe estar listo para empezar a probar un lote. Salida: cobertura de criterios y de reglas, porcentaje de casos ejecutados y aprobados por prioridad, y defectos abiertos permitidos por severidad (según `test-severity-priority.md`). Suspensión y reanudación: cuándo se detienen las pruebas y qué las reactiva.
9. **Gestión de defectos.** Flujo, herramienta, datos obligatorios y tiempos de atención, citando `test-severity-priority.md` sin copiarlo.
10. **Calendario y esfuerzo.** Actividades de prueba por sprint o por lote, si hay plan de sprints; si no, por módulo en orden de riesgo. Esfuerzo en rangos y de dónde sale.
11. **Roles y responsabilidades.** Quién escribe, revisa, ejecuta, automatiza y aprueba.
12. **Entregables de prueba.** Lista con el paso del pipeline que produce cada uno.
13. **Métricas.** Cuáles se reportan y con qué frecuencia: cobertura, avance de ejecución, defectos por severidad, densidad por módulo, estabilidad de la automatización.
14. **Riesgos del proceso de pruebas y mitigaciones.** Ambientes inestables, datos, dependencias de terceros, tiempos.
15. **Supuestos y preguntas abiertas.**

Reglas:

- Cada dato lleva su marca: `[CONFIRMADO: ...]`, `[INFERIDO]` o `[POR CONFIRMAR: OQ-NNN]`. Las preguntas se registran con `--origen 02a-test-plan`.
- Todos los módulos en alcance de `scope.md` aparecen en el análisis de riesgo. Ninguno se omite en silencio.
- Los criterios de salida usan números, no adjetivos.
- Registra como decisiones lo que el usuario eligió en la sección 2.

## 5. Modo REGENERAR

Conserva los niveles de riesgo ya acordados salvo que la información nueva los cambie, y documenta en "Cambios respecto a la versión anterior" qué cambió y por qué. Si cambia el enfoque de un nivel de riesgo, dilo de forma destacada: los casos de prueba ya escritos quedarán desactualizados.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <historias>/user-stories.md context-pack/scope.md context-pack/domain.md context-pack/business-processes.md \
             context-pack/constraints.md context-pack/risks.md context-pack/security.md context-pack/test-standards.md \
             context-pack/test-severity-priority.md context-pack/test-data-policy.md \
             context-pack/automation-standards.md context-pack/environments.md \
  --oq <OQ creadas> --resumen "<N> módulos (<A> de riesgo alto), <T> tipos de prueba, meta de automatización <X>"
```

Deja la nota de sesión (ver "Cerrar" en el protocolo). Resume los módulos de riesgo alto, lo que quedó fuera, los criterios de salida y las preguntas abiertas. Siguiente paso: `/delivery:review-deliverable 02a-test-plan` si quieres una revisión independiente, y luego `/delivery:generate-test-cases <lote>`.
