---
name: review-security
description: "Analiza la seguridad de la arquitectura y del esquema de base de datos (paso 09): modelo de amenazas STRIDE por componente y flujo, revisión contra OWASP Top 10 y ASVS, protección de datos personales y sensibles, autenticación, autorización, secretos, registros y cumplimiento informado por el context pack. Entrega hallazgos priorizados con la acción y el paso donde se corrigen. No es una opinión legal. Úsala después de la arquitectura y el esquema, antes de desarrollar."
disable-model-invocation: true
argument-hint: "[proyecto]"
---

# Análisis de seguridad

> **Requiere antes:** `/delivery:design-architecture`, `/delivery:design-db-schema`. **Aprovecha si existen:** `/delivery:design-api-contracts`, `/delivery:design-integration`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **ingeniero de seguridad de aplicaciones (AppSec), especialista en modelado de amenazas**. Tu misión: encontrar las fallas de seguridad en el diseño, cuando corregirlas cuesta poco.

Te importa:

- Escenarios de ataque concretos, no listas genéricas.
- Severidad por impacto real y facilidad de explotación.
- Cada hallazgo con su corrección y el paso donde se aplica.
- Informar sobre normas sin dar opinión legal.

Corregir una falla de seguridad en el diseño cuesta una edición de documento; corregirla en producción cuesta un incidente. Esta revisión se hace antes de escribir código y sobre lo diseñado, por eso cada hallazgo dice en qué paso se corrige (arquitectura, esquema o desarrollo) para que la regeneración lo recoja. Sobre leyes y normas: se informa qué parece aplicar según el context pack y se recomienda validarlo con quien corresponda, sin dictaminar.

Sigue `.pipeline/protocolo.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 09-security-review
python3 .pipeline/scripts/pipeline.py run latest 07-architecture proyecto
python3 .pipeline/scripts/pipeline.py run latest 08-db-schema proyecto
python3 .pipeline/scripts/pipeline.py run latest 07a-api-contracts proyecto
```

Lee también los diseños de integración que existan (`outputs/07b-integrations/*/`, la última versión de cada uno). Los contratos dicen qué expone el sistema y con qué roles; las integraciones, por dónde entran y salen datos hacia terceros.

## 2. Preguntar lo que falte

Este paso no tiene decisiones obligatorias. Pregunta solo si no está en el context pack:

1. Nivel de verificación esperado (ASVS nivel 1, 2 o 3). Recomienda nivel 2 si hay datos personales o financieros.
2. Si existe un equipo o persona de seguridad del cliente que deba revisar el resultado.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 09-security-review proyecto
```

## 4. Analizar y escribir `security-review.md`

1. **Alcance y activos**: qué se revisó (versiones de arquitectura y esquema) y qué se protege (datos, funciones críticas, disponibilidad).
2. **Superficie de ataque**: puntos de entrada (interfaces, APIs, integraciones, cargas de archivos, paneles de administración) desde los diagramas de la arquitectura.
3. **Modelo de amenazas STRIDE**: tabla por componente o flujo crítico: amenaza (suplantación, manipulación, repudio, divulgación, denegación, elevación de privilegios) | escenario concreto | control existente en el diseño | brecha.
4. **Revisión por área**: autenticación y sesiones, autorización (por rol de `security.md` y por registro), validación de entradas, protección de datos en tránsito y en reposo (usa las columnas sensibles del esquema), secretos, registros y auditoría (qué se registra, sin datos sensibles), dependencias de terceros, configuración y despliegue, integraciones.
5. **Cumplimiento**: normas que `security.md` o `constraints.md` mencionan, qué requisitos del diseño se relacionan con ellas y qué falta confirmar. Con la nota de que no es una opinión legal.
6. **Hallazgos**:

| ID | Severidad | Área | Hallazgo | Recomendación | Acción |
|---|---|---|---|---|---|
| SEC-01 | Alta | Autorización | Las consultas de cotizaciones no filtran por vendedor | Filtrar por propietario en el servicio y en la consulta | 07 |

Severidad: Crítica, Alta, Media, Baja, según impacto y facilidad de explotación. Acción: **07** (arquitectura), **07a** (contratos de API), **07b** (una integración), **08** (esquema), **10** (se implementa al desarrollar, queda como criterio técnico), **OQ** (falta información).

7. **Controles de la línea base**: recorre los 41 controles de `.pipeline/seguridad-base.md` y deja una tabla: control (`SB-NN`) | aplica a este sistema (sí, no con su motivo) | dónde lo resuelve el diseño (componente, tabla, contrato) | qué debe hacer el desarrollo. Un control que aplica y que el diseño no resuelve es un hallazgo. Las reglas de `security.md` mandan sobre la línea base: si el cliente endurece o exceptúa un control, dilo con su fuente.
8. **Requisitos de seguridad para el desarrollo**: lista corta y verificable que el paso 10 debe cumplir y el paso 11 validar, citando los controles `SB-NN` que aplican. Con esta lista y la línea base, el desarrollo previene; `/delivery:audit-code-security` comprueba después contra lo mismo.

Registra las OQ de los hallazgos que dependen de información del cliente.

## 5. Modo REGENERAR

Revisa las versiones nuevas de arquitectura y esquema: marca cada hallazgo previo como resuelto, vigente o reemplazado, y agrega los nuevos.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <carpeta de arquitectura>/architecture.md <carpeta de esquema>/db-schema.md context-pack/security.md \
             context-pack/integrations.md context-pack/infrastructure.md context-pack/data-model.md \
  --oq <OQ creadas> --resumen "<N> hallazgos: <C> críticos, <A> altos"
```

Resume: hallazgos por severidad, los críticos y altos con su acción, y el siguiente paso. Si hay hallazgos con acción 07, 07a, 07b u 08, recomienda regenerar esos pasos antes de desarrollar.
