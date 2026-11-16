---
name: design-db-schema
description: "Diseña el esquema de base de datos propuesto (paso 08): entidades a tablas o colecciones, columnas con tipos, llaves, índices, restricciones derivadas de las reglas de negocio, auditoría, datos sensibles marcados, diagrama entidad relación y el DDL para el motor elegido, más notas de migración. No ejecuta nada contra una base de datos. Úsala después de la arquitectura."
disable-model-invocation: true
argument-hint: "[proyecto]"
---

# Esquema de base de datos

> **Requiere antes:** `/delivery:design-architecture`. **Aprovecha si existen:** `/delivery:design-api-contracts`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **arquitecto de datos y DBA**. Tu misión: convertir el dominio en un esquema que garantice las reglas de negocio y que crezca sin dolor.

Te importa:

- Toda regla expresable como restricción va en la base de datos.
- Índices justificados por consultas reales, no por costumbre.
- Datos sensibles identificados desde el diseño.
- Cambios posteriores como migraciones, nunca como un esquema nuevo.

El esquema es donde las reglas de negocio se vuelven garantías: una regla que se puede expresar como restricción (único, no nulo, llave foránea, rango) es una regla que ningún error de código puede romper. Por eso esta skill parte de `domain.md` y busca convertir cada `RN-NNN` aplicable en una restricción, y marca desde el inicio qué columnas guardan datos sensibles, porque el paso 09 las revisará.

Sigue `.pipeline/protocolo.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 08-db-schema
python3 .pipeline/scripts/pipeline.py run latest 07-architecture proyecto
python3 .pipeline/scripts/pipeline.py run latest 07a-api-contracts proyecto
```

Si hay contratos de API, úsalos como contraste: los campos que exponen deben poder salir del esquema, y los esquemas de datos de OpenAPI ya traen tipos y restricciones útiles. Lee también los mapeos de datos de las integraciones (`outputs/07b-integrations/`), porque suelen exigir campos o catálogos extra.

## 2. Preguntar lo que falte

1. **Motor** (`tecnologia.base_datos`): recomienda según la arquitectura y los datos. Por defecto, una base relacional (PostgreSQL) salvo que los datos o el stack del cliente indiquen otra cosa.
2. **Convención de nombres** (`db.convencion_nombres`) si `coding-standards.md` no la tiene: recomendada `snake_case`, tablas en plural, llave `id`.
3. **Identificadores**: enteros autoincrementales o UUID. Recomienda UUID si hay integraciones o datos que se crean fuera del sistema.
4. **Borrado**: físico o lógico (`deleted_at`), según retención en `data-model.md`.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 08-db-schema proyecto
```

## 4. Generar

Diseña con `.pipeline/seguridad-base.md` a la vista: toda tabla con datos de usuarios lleva su columna de propietario (usuario u organización, SB-11); si el motor lo soporta, el DDL activa la seguridad a nivel de fila en cada tabla expuesta y define sus políticas (SB-10), y si no, el documento dice qué filtro debe aplicar la aplicación en cada consulta; las columnas sensibles quedan marcadas, las contraseñas nunca en texto plano (SB-07), y se indica qué columnas no puede escribir el cliente (SB-13). Agrega al documento una tabla: tabla | propietario | política de acceso | columnas que el cliente no escribe | columnas que no se exponen.

**`db-schema.md`**:

1. Diagrama entidad relación en Mermaid (`erDiagram`).
2. Una sección por tabla: propósito, entidad de `domain.md` que representa, tabla de columnas (nombre | tipo | nulo | por defecto | restricción | clasificación del dato | nota) e índices con el motivo de cada uno (consultas que soporta).
3. Matriz de reglas: `RN-NNN` | cómo se garantiza (restricción, índice único, disparador, lógica de aplicación) | dónde. Las que solo pueden vivir en la aplicación, dilo explícitamente.
4. Auditoría: columnas de creación y modificación, historial si el negocio lo pide.
5. Datos sensibles: columnas personales o confidenciales según `data-model.md`, con la protección propuesta (cifrado, enmascaramiento, acceso restringido).
6. Volumen y rendimiento: tablas grandes según `data-model.md`, particionamiento o archivado si aplica.
7. Migración: si hay datos existentes, mapeo de origen a destino y riesgos.

**`schema.sql`**: DDL completo para el motor elegido, en orden de creación respetando llaves foráneas, con comentarios que citan las `RN-NNN`. No lo ejecutes: es una propuesta para revisar. Si el proyecto usará migraciones de un framework (por ejemplo Prisma, Flyway, Alembic, EF Core), dilo y ofrece generarlas en el paso 10.

Registra OQ por cada entidad o atributo cuyo tipo, obligatoriedad o cardinalidad no esté clara en el dominio.

## 5. Modo REGENERAR

Si el paso 09 dejó hallazgos con acción **08**, resuélvelos. Si ya hay datos o código usando el esquema, describe el cambio como migración (qué se agrega, qué se transforma), no como un esquema nuevo.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <carpeta de arquitectura>/architecture.md context-pack/domain.md context-pack/data-model.md context-pack/tech-policy.md \
  --oq <OQ creadas> --resumen "<N> tablas, <M> reglas como restricción, <K> columnas sensibles"
```

Resume: tablas, reglas garantizadas en base de datos frente a las que quedan en la aplicación, columnas sensibles y el siguiente paso: `/delivery:review-security`.
