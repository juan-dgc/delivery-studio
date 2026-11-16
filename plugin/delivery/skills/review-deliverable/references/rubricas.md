# Rúbricas de revisión

Pesos entre paréntesis. Los marcados como **crítico** rechazan el entregable si quedan por debajo de 60.

## Chequeos comunes a todo entregable

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-01 | Fidelidad a los insumos (100, crítico) | Lo que afirma coincide con el context pack y con los pasos anteriores. Nada los contradice ni los cambia en silencio. |
| RV-02 | Sin invenciones (100, crítico) | Cifras, nombres, reglas, mensajes y tecnologías tienen fuente o están marcados como inferidos o por confirmar. Las preguntas abiertas están registradas. |
| RV-03 | Completitud (100) | Cubre todo lo que sus insumos exigen: ningún módulo, regla, historia o requisito del alcance quedó sin tratar ni sin exclusión declarada. |
| RV-06 | Coherencia con otros lotes (60) | Solo en entregables por lote: respeta las dependencias entre historias, reutiliza y cita lo que ya existe en otros lotes en vez de duplicarlo, no contradice cómo se trató la misma regla en otro lote y declara qué queda expuesto a regresión. |
| RV-04 | Consistencia interna (60) | IDs sin duplicar, referencias que existen, resúmenes y totales que coinciden con el contenido, mismos términos que `domain.md`. |
| RV-05 | Sirve para lo que sigue (100, crítico) | Chequeo de control, se califica al final: el siguiente paso puede trabajar con esto sin volver a preguntar; no es una versión general que aparenta estar completa. |

## 01 Propuesta comercial

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Entiende al cliente (100, crítico) | Usa las palabras, cifras y dolores del cliente que están en la evidencia; no es una propuesta genérica. |
| RV-11 | Números correctos (100, crítico) | Totales, IVA, pagos por hito y plazos coinciden con `estimacion.json` y entre secciones. |
| RV-12 | Alcance y supuestos (100) | Lo incluido, lo excluido y los supuestos son claros y protegen de un malentendido de alcance. |
| RV-13 | Facilidad para decidir (60) | Resumen ejecutivo autosuficiente, opciones comparables, siguiente paso concreto con fecha. |
| RV-14 | Presentación (40) | Sin campos entre corchetes olvidados, sin rayas largas, marca correcta, paginación limpia. |

## 02 Historias de usuario

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Criterios verificables (100, crítico) | Cada criterio describe un resultado observable y medible. Sin "rápido", "fácil", "adecuado". |
| RV-11 | Reglas y procesos cubiertos (100) | Resultado de `check_trace.py historias`, y que las exclusiones de "Sin historia" tengan motivo válido. |
| RV-12 | Tamaño y valor (60) | Una historia, un valor para un rol real; ninguna mezcla roles o esconde varias historias (INVEST). |
| RV-13 | Caminos no felices (80) | Los criterios cubren validaciones, errores, permisos y casos límite, no solo el camino feliz. |
| RV-14 | Detalle del dominio (80) | Los criterios llevan las cifras, estados, mensajes y excepciones que el context pack trae. |

## 02a Plan de pruebas

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Enfoque por riesgo (100, crítico) | Todos los módulos tienen nivel de riesgo justificado y la profundidad de pruebas cambia según ese nivel. |
| RV-11 | Criterios medibles (100) | Entrada, salida y suspensión con números, coherentes con `test-severity-priority.md`. |
| RV-12 | Alcance y exclusiones (80) | Lo que no se prueba está dicho, con motivo y riesgo aceptado. |
| RV-13 | Viabilidad (80) | Se puede cumplir con los ambientes, datos, personas y tiempo que el proyecto tiene. |
| RV-14 | Coherencia con la automatización (60) | No contradice `automation-standards.md`; la meta es realista. |

## 03 Casos de prueba

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Prueban lo que dicen (100, crítico) | Los pasos y el resultado esperado de cada caso de verdad verifican el criterio que declaran cubrir. |
| RV-11 | Cobertura de criterios y reglas (100, crítico) | Resultados de `coverage.py` y `check_trace.py casos`; reglas con caso negativo. |
| RV-12 | Ejecutables sin preguntar (100) | Pasos concretos, datos definidos, precondiciones completas, resultado observable. Otra persona puede ejecutarlos. |
| RV-13 | Técnicas de diseño (80) | Límites, particiones, estados y permisos donde el dominio los pide; coherente con el plan de pruebas si existe. |
| RV-14 | Prioridad y proporción (60) | Prioridades según riesgo; sin exceso de casos de baja prioridad ni historias solo con casos positivos. |
| RV-15 | Independencia y datos (40) | Los casos no dependen del orden; los datos cumplen `test-data-policy.md`. |

## 04 Cobertura, 13 Candidatos, 18 Defectos (reportes de análisis)

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Conclusiones sustentadas (100, crítico) | Cada conclusión sale de los datos del reporte; recalcula una muestra. |
| RV-11 | Criterio explícito (80) | Se entiende por qué cada elemento quedó clasificado como quedó (brecha, candidato, severidad). |
| RV-12 | Accionable (80) | Dice qué hacer, en qué orden y con qué prioridad. |
| RV-13 | Reproducible (80) | En defectos: pasos, datos, resultado esperado y obtenido, evidencia. En candidatos: nivel de automatización justificado. |

## 05 Sistema de diseño

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Fiel a la identidad del cliente (100, crítico) | Tokens y componentes salen de `ux-design.md` y de la evidencia, no de un estilo genérico. |
| RV-11 | Cubre las historias (100) | Existen los componentes y estados que las historias necesitan. |
| RV-12 | Accesibilidad (80) | Contraste, foco, tamaños táctiles y estados de error. |

## 06 Plan de sprints

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Dependencias respetadas (100, crítico) | Ninguna historia va antes que otra de la que depende. |
| RV-11 | Capacidad realista (100) | La carga de cada sprint cabe en la capacidad declarada. |
| RV-12 | Valor y riesgo primero (60) | Lo crítico y lo incierto se atacan temprano. |

## 07 Arquitectura, 07a Contratos, 07b Integraciones, 08 Esquema, 09 Seguridad (diseño técnico)

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | Resuelve los requisitos (100, crítico) | Cada historia y cada requisito no funcional de `constraints.md` tiene dónde resolverse. |
| RV-11 | Respeta las políticas (100, crítico) | Stack, estándares y restricciones de `tech-policy.md`, `arch-standards.md` y `security.md`. |
| RV-12 | Seguridad desde el diseño (100) | Los controles de `.pipeline/seguridad-base.md` que aplican están previstos: propietario por registro, permisos en servidor, campos escribibles, secretos. |
| RV-13 | Coherencia entre artefactos (80) | Contratos, esquema y arquitectura nombran y modelan lo mismo. |
| RV-14 | Decisiones justificadas (60) | Cada decisión relevante tiene alternativas consideradas y motivo. |
| RV-15 | Proporción (60) | Sin sobreingeniería para el tamaño y el plazo del proyecto. |

## 10 a 12 y 14 a 19 (registros de trabajo sobre repositorios y ambientes)

Para el registro de implementación, validación, exploración, framework, automatización, ejecución y CI/CD.

| ID | Chequeo | Qué se revisa |
|---|---|---|
| RV-10 | El registro coincide con la realidad (100, crítico) | Lo que dice que se hizo existe en el repositorio o en los reportes: archivos, pruebas, commits. Comprueba una muestra. |
| RV-11 | Trazabilidad a casos e historias (100) | Cada prueba o cambio apunta a su TC y su US; nada del alcance quedó sin estado. |
| RV-12 | Fallas bien clasificadas (80) | Se distingue defecto, error del script, ambiente e inestabilidad, con evidencia. |
| RV-13 | Pendientes explícitos (60) | Lo que no se hizo está dicho con su motivo y su siguiente paso. |
