---
documento: automation-standards.md
when_to_read: |
  Antes de decidir qué automatizar, explorar la aplicación para sacar selectores, armar el framework, escribir o ejecutar pruebas automatizadas, o configurar su pipeline.
usado_por: [13-automation-candidates, 14-web-exploration, 15-automation-framework, 16-automation-tests, 17-automation-run, 19-cicd-automation]
estado: borrador
version: 1
actualizado: AAAA-MM-DD
---

# Estándares de automatización

## Propósito

<!-- Guía: Una o dos frases: qué gobierna este documento para este proyecto. -->

## Estado actual de la automatización

<!-- Guía: Qué existe hoy: cobertura automatizada, cantidad de pruebas, framework, repositorio, quién lo mantiene. Si no existe nada, dilo con su fuente; es el dato más importante del documento. -->

## Alcance y exclusiones

<!-- Guía: Qué se va a automatizar y qué queda expresamente fuera (por ejemplo telefonía, captchas, pruebas no funcionales), con el motivo. -->

## Criterios para automatizar

<!-- Guía: Qué hace que un caso sea buen candidato según el cliente: repetitivo, estable, crítico, con datos controlables. Si el cliente tiene criterios propios, mandan sobre los del paso 13. -->

## Framework y lenguaje

<!-- Guía: Framework, lenguaje, versión y patrón de diseño aprobados o propuestos, y dónde vive el código de automatización. Lo no decidido queda para el paso 15. -->

## Estrategia de localizadores

<!-- Guía: Orden de preferencia de selectores, atributos de prueba disponibles en la aplicación (por ejemplo data-testid) y qué está prohibido (rutas absolutas, índices). -->

## Esperas, reintentos e inestabilidad

<!-- Guía: Reglas de esperas, número de reintentos permitido y qué se hace con una prueba inestable. -->

## Convenciones de nombres y estructura

<!-- Guía: Formato de títulos, etiquetas, carpetas, y cómo se enlaza cada prueba con su caso y su historia en la herramienta del cliente. -->

## Datos y sesiones

<!-- Guía: Cómo obtienen datos y sesión las pruebas automatizadas; el detalle de datos está en test-data-policy.md y el de cuentas en environments.md. -->

## Ejecución y reportes

<!-- Guía: Dónde y cuándo se ejecutan (local, CI, nocturno), qué reporte se produce, dónde se publica y quién lo revisa. -->

## Revisión y gobierno

<!-- Guía: Quién aprueba una prueba automatizada antes de sumarla a la regresión y con qué criterios. -->

## Reglas obligatorias

<!-- Guía: Todas las reglas de este tema que los siguientes pasos deben respetar, una por viñeta, concreta y verificable, con su fuente [CONFIRMADO: EV-NNN.N]. No las resumas: si la evidencia trae quince reglas, van las quince. -->

## Reglas recomendadas

<!-- Guía: Buenas prácticas y preferencias que no son obligatorias. Las deducidas van con [INFERIDO] y su motivo. Lo propuesto pero no adoptado va aquí marcado como propuesta, nunca en Reglas obligatorias. -->

## Restricciones y prohibiciones

<!-- Guía: Lo que no se debe hacer ni asumir, en forma de 'No ...', cada una con su fuente. Incluye lo que NO existe y alguien podría dar por hecho (por ejemplo, 'No asumir que hay pruebas automatizadas'). -->

## Ejemplos

<!-- Guía: Al menos un ejemplo 'Válido:' y uno 'Inválido:' tomados del proyecto, que muestren cómo se aplica una regla de este documento. -->

## Excepciones

<!-- Guía: Casos en que una regla no aplica, quién lo autoriza y la fuente. Si no hay, 'Ninguna documentada'. -->

## Supuestos

<!-- Guía: Lo que se asumió para poder avanzar. Cada supuesto marcado [INFERIDO] con su motivo. -->

## Pendientes

<!-- Guía: Lista de vacíos: '- [POR CONFIRMAR: OQ-NNN] qué falta'. Cada pendiente tiene su OQ en open-questions.md. -->

## Trazabilidad

<!-- Guía: Lista de evidencias usadas: '- EV-NNN: título de la fuente'. También DEC y OQ incorporadas. -->

## Historial

<!-- Guía: '- v1 (AAAA-MM-DD): generado desde evidence/' y una línea por cada regeneración o incorporación de OQ. -->
