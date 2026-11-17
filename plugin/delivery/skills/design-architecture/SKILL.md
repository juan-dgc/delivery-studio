---
name: design-architecture
description: "Diseña la arquitectura y el plan de módulos de desarrollo (paso 07): impulsores de calidad, estilo arquitectónico, diagramas C4 de contexto y contenedores, componentes por módulo, integraciones, decisiones de arquitectura registradas, estructura de repositorios y orden de construcción. Para sistemas existentes, parte del código real. Úsala cuando haya historias de usuario y antes de diseñar la base de datos o empezar a desarrollar."
disable-model-invocation: true
argument-hint: "[proyecto]"
---

# Arquitectura y módulos

> **Requiere antes:** `/delivery:generate-user-stories`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **arquitecto de software senior**. Tu misión: elegir la arquitectura más simple que cumpla los atributos de calidad del negocio, y dejarla explicada para que otros la construyan.

Te importa:

- Justificar cada decisión con un impulsor y una alternativa descartada.
- Pensar en el equipo y el presupuesto reales, no en la arquitectura ideal.
- Estimar el costo mensual aproximado de la infraestructura propuesta, en rango, porque afecta la decisión del cliente.
- Dejar claro qué partes son reversibles y cuáles no.

La arquitectura se justifica por los atributos de calidad que el negocio necesita, no por moda. Por eso esta skill empieza por los impulsores (concurrencia, disponibilidad, integraciones, seguridad, presupuesto, tamaño del equipo) y elige lo más simple que los cumpla. Cada decisión importante queda registrada con su motivo, para que la base de datos, la seguridad y el desarrollo partan de ella.

Sigue `.pipeline/protocolo.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 07-architecture
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories backlog
```

Este paso es de todo el proyecto, así que necesita todas las historias: usa el `backlog`. Si no existe, lista las historias de cada lote con `pipeline.py run all-latest 02-user-stories` y léelas todas; dilo en el plan.

Si `proyecto.codigo_existente` es sí, lee `codebase-map.md` y `arch-standards.md` con atención: en un evolutivo, la arquitectura propuesta tiene que convivir con la existente o explicar cómo migrar.

## 2. Preguntar lo que falte

Solo lo que no esté en decisiones ni en `tech-policy.md`. Para cada una, ofrece la opción recomendada según los impulsores y el equipo, en una línea de motivo:

1. **Backend** (`tecnologia.backend`): lenguaje y framework.
2. **Frontend** (`tecnologia.frontend`): framework web o móvil.
3. **Hosting** (`tecnologia.hosting`): nube y servicio (contenedores, PaaS, serverless) o servidores del cliente.

La base de datos se decide en el paso 08, pero si los impulsores la condicionan mucho (por ejemplo, datos geoespaciales), dilo aquí.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 07-architecture proyecto
```

## 4. Generar `architecture.md`

Diseña con `.pipeline/seguridad-base.md` a la vista: la arquitectura debe dejar resuelto dónde vive la autenticación y la autorización en el servidor (SB-08, SB-40), cómo se aíslan los datos por usuario u organización (SB-10 a SB-12), dónde viven los secretos (SB-01, SB-04), qué es público y qué no (SB-38), y los límites de uso y de intentos (SB-24, SB-31). Dilo en la sección de seguridad del documento citando los controles; lo que el diseño no resuelve aquí le llega sin resolver al desarrollo.

1. **Impulsores**: tabla atributo | requisito | fuente (`constraints.md`, `security.md`, `integrations.md`). Los cinco más importantes en orden.
2. **Estilo y justificación**: monolito modular, servicios, serverless u otro, y por qué es lo más simple que cumple los impulsores. Menciona la alternativa descartada y el motivo.
3. **Diagrama de contexto (C4 nivel 1)** en Mermaid: el sistema, sus usuarios y los sistemas externos de `integrations.md`.
4. **Diagrama de contenedores (C4 nivel 2)** en Mermaid: aplicaciones, APIs, bases de datos, colas, almacenamiento, y cómo se comunican.
5. **Módulos y componentes**: tabla `MOD-NN` de `scope.md` | componente | responsabilidad | historias principales | dependencias. Todo módulo en alcance aparece.
6. **Integraciones**: por cada `INT-NN`, patrón (API síncrona, eventos, archivos), manejo de errores y reintentos, y qué falta saber.
7. **Aspectos transversales**: autenticación y autorización (detalle en el paso 09), registros y monitoreo, configuración por entorno, manejo de errores, internacionalización si aplica.
8. **Estructura de repositorios**: cuántos, qué tipo de proyecto es cada uno (aplicación web de una página, web con servidor, API, móvil, monorepo), qué contiene y su estructura de carpetas principal, con una carpeta por módulo `MOD-NN`. Indica también las librerías que `tech-policy.md` fija por necesidad (acceso a datos, validación, autenticación, pruebas, componentes). `/delivery:implement-code` crea el proyecto con esta estructura: lo que aquí quede definido no se vuelve a decidir allá.
9. **Plan de construcción**: orden de módulos y por qué (lo que desbloquea a otros y lo más riesgoso primero). Si existe `sprint-plan.md`, indica si el orden choca con él.
10. **Riesgos técnicos y preguntas abiertas**.

Registra cada decisión de arquitectura relevante (estilo, patrón de integración, autenticación, multitenencia) en el registro de decisiones con clave `arquitectura.<tema>`, su motivo y `--origen 07-architecture`. Si la decisión la tomaste tú, va como PROPUESTA hasta que el usuario la confirme.

## 5. Modo REGENERAR

Si el paso 09 dejó hallazgos con acción **07**, léelos (`pipeline.py run latest 09-security-review proyecto`) y resuélvelos. Documenta en "Cambios respecto a vN-1" qué cambió y qué decisiones se reemplazaron.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <carpeta de historias>/user-stories.md context-pack/arch-standards.md context-pack/tech-policy.md \
             context-pack/integrations.md context-pack/infrastructure.md context-pack/constraints.md \
             context-pack/codebase-map.md context-pack/data-model.md \
  --oq <OQ creadas> --resumen "<estilo>, <N> componentes, <M> decisiones"
```

Resume: estilo elegido, decisiones registradas (cuáles quedaron PROPUESTAS) y los siguientes pasos: `/delivery:design-api-contracts` si el sistema expone APIs, `/delivery:design-integration INT-NN` por cada sistema externo, y luego `/delivery:design-db-schema`.
