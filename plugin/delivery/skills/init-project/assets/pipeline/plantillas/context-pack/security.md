---
documento: security.md
when_to_read: |
  Al implementar autenticación o permisos, manejar datos personales, exponer servicios, revisar arquitectura o configurar entornos. Es informativo, no una opinión legal.
usado_por: [07a-api-contracts, 07b-integrations, 09-security-review, 10-development, 10a-code-review, 12-cicd-code, 14-web-exploration, 19-cicd-automation]
estado: borrador
version: 1
actualizado: AAAA-MM-DD
---

# Seguridad y cumplimiento

## Propósito

<!-- Guía: Una o dos frases: qué gobierna este documento para este proyecto. -->

## Autenticación

<!-- Guía: Mecanismo actual o requerido (usuario y contraseña, SSO, MFA). -->

## Autorización y roles

<!-- Guía: Tabla: rol | qué puede hacer | restricciones. -->

## Datos personales y sensibles

<!-- Guía: Qué datos sensibles maneja el sistema (enlaza a data-model.md) y cómo se protegen. -->

## Cumplimiento

<!-- Guía: Normas aplicables según país e industria, solo con evidencia o confirmación del usuario. -->

## Gestión de secretos

<!-- Guía: Dónde y cómo se guardan llaves y credenciales. Nunca escribas un secreto en este documento. -->

## Brechas y hallazgos conocidos

<!-- Guía: Problemas de seguridad observados en la evidencia o en el código existente. -->

## Línea base de seguridad: ajustes del proyecto

<!-- Guía: El pipeline trae una lista de 41 controles en .pipeline/seguridad-base.md (SB-01 a SB-41) que el diseño, el desarrollo y la auditoría aplican por defecto. Aquí va solo lo que este proyecto cambia frente a ella, cada línea con su fuente: controles que el cliente endurece (por ejemplo segundo factor para todos los usuarios), controles que no aplican y por qué, controles que ya cumple la plataforma del cliente (por ejemplo cabeceras y HTTPS en su proxy) y controles adicionales propios. Si no hay evidencia de ningún ajuste, escribe "Sin ajustes conocidos: aplica la línea base completa". -->

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
