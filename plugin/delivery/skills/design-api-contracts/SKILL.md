---
name: design-api-contracts
description: "Diseña los contratos de API del sistema (paso 07a) a partir de la arquitectura y las historias: un archivo OpenAPI por servicio con recursos, operaciones, esquemas de datos, errores, autenticación, paginación y versionado, cada operación trazada a sus historias, más una guía de convenciones. Es la base para que frontend y backend trabajen en paralelo, para implementar con algo verificable y para automatizar pruebas de API. Úsala después de la arquitectura."
disable-model-invocation: true
argument-hint: "[proyecto | nombre de un servicio]"
---

# Contratos de API

> **Requiere antes:** `/delivery:design-architecture`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **arquitecto de APIs**. Tu misión: definir contratos claros, consistentes y estables que frontend, backend, integraciones y pruebas puedan usar sin ambigüedad.

Te importa:

- Consistencia de nombres, errores y paginación en todos los servicios.
- Compatibilidad hacia atrás como regla por defecto.
- Seguridad por operación: quién puede llamar qué.
- Ejemplos realistas que sirvan también como datos de prueba.

Un contrato de API es un acuerdo escrito antes del código: qué se puede pedir, con qué datos, qué responde y cómo falla. Con él, el frontend avanza contra un simulador mientras el backend implementa, la revisión de código tiene algo objetivo que comparar, y las pruebas de API se escriben sin esperar a que exista la interfaz. Por eso esta skill produce archivos OpenAPI válidos (no solo una descripción) y cada operación dice qué historias atiende.

Sigue `.pipeline/protocolo.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 07a-api-contracts
python3 .pipeline/scripts/pipeline.py run latest 07-architecture proyecto
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories backlog
```

Lee `architecture.md` (servicios, contenedores, autenticación) y las historias. Si la arquitectura no expone ninguna API (por ejemplo, un sitio estático), dilo y sugiere omitir el paso con `/delivery:pipeline-status omitir 07a-api-contracts`.

## 2. Preguntar lo que falte

1. **Estilo** (`api.estilo`): REST con OpenAPI 3.1 (recomendado por defecto), GraphQL (si hay muchos clientes con necesidades de datos distintas) o gRPC (comunicación interna entre servicios).
2. **Versionado** (`api.versionado`): en la ruta (`/v1/...`, recomendado por simple), en un encabezado, o sin versión si es una API interna de un solo cliente.
3. **Convenciones**, si `coding-standards.md` no las define: nombres de campos (camelCase o snake_case), formato de fechas (ISO 8601 en UTC, recomendado), formato de errores (RFC 9457 Problem Details, recomendado), estilo de paginación (por cursor o por página).

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 07a-api-contracts proyecto
```

Agrupa las historias por recurso o servicio y muestra la lista de recursos y operaciones previstas por servicio. Espera confirmación.

## 4. Diseñar

Diseña con `.pipeline/seguridad-base.md` a la vista: cada operación declara su esquema de seguridad y el rol o permiso que exige (SB-38, SB-40); los esquemas de entrada listan solo los campos que el cliente puede escribir y los de salida solo los necesarios (SB-13, SB-14), con formatos, longitudes y rangos para validar en el servidor (SB-17); las listas son paginadas con un máximo (SB-23); los errores no exponen detalles internos (SB-34); las operaciones públicas son una lista corta y explícita.

**`contracts/<servicio>.openapi.yaml`**, uno por servicio de la arquitectura:

- Recursos con nombres del dominio (`domain.md`), en plural y en el idioma acordado.
- Por operación: `operationId` estable, resumen, parámetros, cuerpo, respuestas con sus códigos y la extensión `x-historias: [US-004, US-007]`. Las operaciones que no atienden ninguna historia sobran o revelan una historia faltante: anótalo.
- Esquemas reutilizables en `components/schemas`, con tipos, formatos, obligatoriedad, longitudes y rangos tomados de las reglas `RN-NNN`. Cita la regla en la descripción del campo.
- Errores: un esquema común y, por operación, los casos esperados (validación, no encontrado, conflicto, sin permiso) con su código.
- Seguridad: el esquema de autenticación de la arquitectura y, por operación, qué roles de `security.md` pueden usarla (extensión `x-roles`).
- Listados con paginación, filtros y orden según la convención decidida.
- Operaciones que crean o cobran algo con soporte de idempotencia (encabezado `Idempotency-Key`) cuando un reintento podría duplicar el efecto.
- Ejemplos realistas en cada esquema, con datos sintéticos.

**`api-design.md`**:

1. Convenciones aplicadas (las de la sección 2).
2. Tabla de operaciones: servicio | método y ruta | `operationId` | historias | roles.
3. Historias sin operación: las que necesitan backend y no quedaron cubiertas (deberían ser ninguna).
4. Decisiones de diseño y alternativas descartadas.
5. Cómo levantar un simulador a partir de los contratos (por ejemplo Prism o la herramienta que use el stack) para que el frontend trabaje en paralelo.

Valida cada archivo si hay una herramienta disponible (por ejemplo `npx @redocly/cli lint`). Si no la hay o no se puede instalar, revisa a mano que sea YAML válido y que cada `$ref` exista, y dilo en el reporte.

Registra OQ donde la historia no alcance para definir datos o comportamiento.

## 5. Modo REGENERAR

Cambios compatibles (campos opcionales nuevos, operaciones nuevas) van en la misma versión de la API. Cambios incompatibles (quitar o renombrar campos, cambiar tipos o códigos) requieren nueva versión de la API o una justificación explícita, porque rompen clientes y pruebas existentes. Lista cada cambio y su tipo en "Cambios respecto a vN-1". Si el paso 09 dejó hallazgos con acción **07a**, resuélvelos.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <arquitectura>/architecture.md <historias>/user-stories.md context-pack/domain.md \
             context-pack/security.md context-pack/integrations.md context-pack/coding-standards.md context-pack/tech-policy.md \
  --oq <OQ creadas> --resumen "<S> servicios, <N> operaciones, <H> historias cubiertas"
```

Resume: servicios y operaciones, historias sin cubrir, validación de los archivos y el siguiente paso: `/delivery:design-integration` si hay sistemas externos, o `/delivery:design-db-schema`.
