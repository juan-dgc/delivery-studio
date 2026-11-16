---
documento: environments.md
when_to_read: |
  Antes de ejecutar algo contra un ambiente, pedir o usar cuentas de prueba, explorar la aplicación, configurar el framework de automatización o un pipeline.
usado_por: [11-dev-validation, 12-cicd-code, 14-web-exploration, 15-automation-framework, 16-automation-tests, 17-automation-run, 19-cicd-automation]
estado: borrador
version: 1
actualizado: AAAA-MM-DD
---

# Ambientes y configuración

## Propósito

<!-- Guía: Una o dos frases: qué gobierna este documento para este proyecto. -->

## Ambientes

<!-- Guía: Tabla: ambiente | propósito | URL | quién lo usa | tipo de datos (reales, enmascarados, sintéticos) | estabilidad | fuente. Si varios usos comparten un mismo ambiente, dilo explícitamente. -->

## Accesos y cuentas de prueba

<!-- Guía: Tabla: rol o perfil | para qué casos se usa | cómo se solicita o quién la entrega | restricciones (doble factor, VPN, horario). Nunca escribas usuarios con contraseñas: solo roles y el nombre de la variable de entorno que guardará cada credencial. -->

## Navegadores y dispositivos

<!-- Guía: Matriz soportada: navegador o dispositivo | versiones | prioridad. Si no está definida, es una pregunta abierta. -->

## Configuración por ambiente

<!-- Guía: Dónde vive la configuración (archivo, variables, servicio de secretos), qué cambia entre ambientes y el nombre de cada variable relevante, sin valores secretos. -->

## Banderas de funcionalidad

<!-- Guía: Mecanismo de banderas, cuáles afectan lo que se prueba y su valor por ambiente. -->

## Datos y estado del ambiente

<!-- Guía: Cómo se refresca o reinicia cada ambiente, con qué frecuencia, ventanas de mantenimiento y qué procesos automáticos corren (por ejemplo tareas programadas) que pueden alterar una prueba. -->

## Dependencias externas por ambiente

<!-- Guía: Qué integraciones están conectadas a servicios reales, a ambientes de prueba del tercero o simuladas, por ambiente. -->

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
