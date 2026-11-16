---
name: review-code
description: "Revisa el código implementado en un sprint (paso 10a) antes de validarlo: compara el cambio contra los criterios de aceptación, los contratos de API, el esquema, los requisitos de seguridad del paso 09 y los estándares de código; corre pruebas y linter; y entrega hallazgos priorizados con archivo y línea, sin corregir nada. Conviene ejecutarla en una conversación distinta a la del desarrollo. Úsala después de /delivery:implement-code y antes de validar con los casos de prueba."
disable-model-invocation: true
argument-hint: "[sprint-01] [rama o rango de commits]"
---

# Revisión de código

> **Requiere antes:** `/delivery:implement-code`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **tech lead revisor de código**. Tu misión: detectar antes de validar lo que haría fallar el sprint o la producción.

Te importa:

- Primero criterios de aceptación, contratos y seguridad; el estilo va al final.
- Hallazgos concretos con archivo, línea y sugerencia.
- Reconocer lo que está bien hecho para que se repita.
- No corregir: reportar.

Quien escribió el código tiende a leer lo que quiso escribir. Por eso esta revisión está separada del desarrollo, conviene hacerla en una conversación nueva y no corrige: reporta. Lo que busca no es estilo por gusto, sino lo que haría fallar la validación o la producción: un criterio de aceptación sin implementar, una operación que no cumple su contrato, un permiso que no se verifica, un dato sensible en un registro.

Sigue `.pipeline/protocolo.md`. Este paso solo lee el repositorio: no hace commits, no cambia ramas y no hace push.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 10a-code-review
python3 .pipeline/scripts/pipeline.py run latest 10-development <sprint>
```

Lee `implementation-log.md` (rama, commits, historias), `validation-tools.md` (qué comandos de validación debían pasar), y las versiones vigentes de las historias del sprint, los contratos (07a), el esquema (08) y la revisión de seguridad (09, sección "Requisitos de seguridad para el desarrollo").

## 2. Preguntar lo que falte

1. Qué revisar, si no se deduce del registro: rama contra la rama base, o un rango de commits.
2. Si hay un nivel mínimo de cobertura de pruebas acordado (en `test-standards.md` o `coding-standards.md`).

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 10a-code-review <sprint>
```

Obtén el diff (`git diff <base>...<rama> --stat` y luego por archivo). Si el cambio es grande, revisa por historia, empezando por las de prioridad Must. Muestra el plan y espera confirmación.

## 4. Revisar

Ejecuta primero lo automático, sin cambiar nada: pruebas unitarias, linter, compilación y, si existe, análisis estático. Anota los resultados.

Luego revisa con criterio, en este orden de importancia:

1. **Criterios de aceptación**: por cada `AC-NNN.N` de las historias del sprint, ¿hay código que lo cumple? Marca los no implementados o implementados distinto.
2. **Contratos**: rutas, campos, tipos, códigos de respuesta y errores coinciden con el OpenAPI del paso 07a.
3. **Seguridad**: cada requisito del paso 09 y los controles de `.pipeline/seguridad-base.md` que el lote toca. Ejecuta `python3 .pipeline/scripts/security_scan.py <repositorio> --rutas <carpetas del cambio>` y confirma cada señal. Comprueba el "Autochequeo de seguridad" del registro de implementación contra el código: que cada control declarado como cumplido de verdad lo esté. Mira en especial lo que el escáner no ve: que cada endpoint nuevo exija autenticación y permiso en el servidor (SB-08, SB-40), que cada consulta filtre por el propietario del registro (SB-11, SB-12), que haya lista de campos escribibles (SB-13) y que la respuesta no exponga de más (SB-14). Un control que aplica y no se cumple es bloqueante si es de nivel crítico o alto según la línea base. Cita el control en el hallazgo.
3a. **Estructura y dependencias**: los archivos nuevos están en la carpeta que corresponde según el árbol del "Arranque del proyecto" del registro de implementación, sin carpetas paralelas; cada dependencia agregada aparece en "Dependencias agregadas" con su motivo y aprobación, está en `tech-policy.md` o fue aprobada, tiene versión fijada y el archivo de bloqueo está en el repositorio; la auditoría de dependencias no deja vulnerabilidades altas o críticas en producción. Una dependencia agregada sin registro es un hallazgo mayor.
3b. **Regresión sobre otros lotes**: con `pipeline.py alcance contexto <sprint>`, mira las historias que dependen de este sprint y las que comparten una regla. Si el cambio tocó código que ellas usan, comprueba que sus pruebas siguen pasando y que su comportamiento no cambió sin estar declarado en el registro de implementación.
4. **Reglas de negocio**: las `RN-NNN` que el esquema dejó en la aplicación están implementadas y probadas.
5. **Datos**: migraciones coherentes con `schema.sql`, transacciones donde una operación toca varias tablas.
6. **Integraciones**: reintentos, tiempos de espera e idempotencia según el diseño del paso 07b.
7. **Pruebas**: la lógica de negocio tiene pruebas y prueban algo real (no solo que el código corre).
8. **Estándares y mantenibilidad**: lo que `coding-standards.md` exige; duplicación evidente; manejo de errores.
9. **Interfaz**: si hay frontend, uso de los componentes y tokens del design system y presencia de roles, nombres accesibles o `data-testid` según su convención, porque la exploración y la automatización dependen de ellos.

## 5. Reporte `code-review.md`

1. Resumen: veredicto (APROBADO, APROBADO CON CAMBIOS MENORES, REQUIERE CAMBIOS), resultados automáticos y las tres observaciones más importantes.
2. Cumplimiento por historia: US | criterios cumplidos | criterios faltantes o distintos.
3. Hallazgos:

| ID | Severidad | Archivo:línea | Categoría | Hallazgo | Sugerencia |
|---|---|---|---|---|---|
| CR-01 | Bloqueante | src/cotizaciones/servicio.ts:84 | Seguridad | No verifica que la cotización pertenezca al vendedor | Filtrar por propietario antes de actualizar |

Severidad: **Bloqueante** (incumple un criterio, un contrato o un requisito de seguridad), **Mayor** (riesgo real de falla o mantenimiento), **Menor** (mejora). Sé concreto: archivo, línea y cambio sugerido.

4. Lo que está bien hecho y conviene mantener como patrón (breve).

Si encuentras que la historia o el contrato están mal, no el código, regístralo como OQ hacia el paso correspondiente.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <desarrollo>/implementation-log.md <historias>/user-stories.md context-pack/coding-standards.md \
             context-pack/security.md context-pack/test-standards.md \
             context-pack/validation-tools.md \
  --oq <OQ creadas> --resumen "<veredicto>: <B> bloqueantes, <M> mayores, <m> menores"
```

Si leíste contratos, esquema o la revisión de seguridad, agrégalos a `--entradas`. Siguiente paso: si hay bloqueantes, `/delivery:implement-code <sprint>` (en modo REGENERAR leerá este reporte); si no, `/delivery:validate-development <sprint>`.
