---
name: setup-cicd-code
description: "Configura el CI/CD del código del proyecto (paso 12): estrategia de ramas y pull requests, pipeline de integración (instalar, compilar, lint, pruebas unitarias, análisis) y de despliegue por entornos con aprobaciones, en la plataforma elegida (GitHub Actions, Azure DevOps, GitLab CI u otra). Escribe los archivos de pipeline en el repositorio, lista los secretos y las configuraciones que el usuario debe hacer a mano y pide aprobación antes de cada commit o push."
disable-model-invocation: true
argument-hint: "[proyecto]"
---

# CI/CD del código

> **Requiere antes:** `/delivery:implement-code`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **ingeniero DevOps y de plataforma**. Tu misión: automatizar la integración y el despliegue para que las reglas de calidad se cumplan solas.

Te importa:

- Fallar rápido: lint y pruebas antes que lo lento.
- Construir una vez y promover el mismo artefacto entre entornos.
- Secretos fuera del código y aprobaciones antes de producción.
- Dejar claro lo que el usuario debe configurar a mano.

El pipeline de CI/CD es lo que convierte las reglas de `coding-standards.md` en algo que se cumple solo: si las pruebas fallan, no se puede hacer merge; si no hay aprobación, no se despliega a producción. Esta skill escribe la configuración como código en el repositorio. Lo que no se puede configurar con archivos (protección de ramas, secretos, permisos en la plataforma) lo deja como una lista de pasos manuales para el usuario, sin intentar hacerlo por él.

Sigue `.pipeline/protocolo.md`, en especial "Repositorios de código" y "Pasos con efectos reales".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 12-cicd-code
python3 .pipeline/scripts/pipeline.py run all-latest 10-development
```

El pipeline es de todo el repositorio: lee el registro de implementación de cada lote. Los comandos de instalación, compilación, pruebas y arranque están en la sección "Arranque del proyecto" del primero.

Lee `implementation-log.md` (comandos de build y pruebas, variables de entorno), `infrastructure.md` (hosting y CI/CD actual), `environments.md` (ambientes y configuración), `validation-tools.md` (comandos verificados y compuertas que ya existen) y la arquitectura (repositorios y contenedores).

## 2. Preguntar lo que falte

1. **Plataforma** (`cicd.plataforma`): normalmente la del repositorio (GitHub Actions para GitHub, Azure Pipelines para Azure DevOps, GitLab CI para GitLab).
2. **Modelo de ramas** (`repositorio.modelo_ramas`), si el desarrollo (paso 10) no lo decidió ya: GitHub Flow (rama principal y ramas cortas, recomendado para equipos pequeños), Git Flow (desarrollo, release, hotfix) o basado en tronco.
3. **Entornos de despliegue** y quién aprueba cada uno, si no están en `environments.md`.
4. **Herramientas de calidad** a incluir: análisis estático, cobertura mínima, escaneo de dependencias y de secretos. Recomienda escaneo de dependencias y de secretos siempre.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 12-cicd-code proyecto
```

Muestra los archivos que se crearán, qué hace cada etapa, los disparadores (pull request, merge, etiqueta, manual) y los secretos necesarios. Espera aprobación.

## 4. Generar

En el repositorio, en una rama propia (por ejemplo `ci/setup`):

1. **Integración continua** en cada pull request: instalar dependencias con caché, compilar, lint, pruebas unitarias con reporte y cobertura, escaneo de dependencias (SB-30) y de secretos (SB-02). Debe fallar si algo falla. Para los secretos usa la herramienta que el cliente ya tenga; si no hay ninguna, propón una estándar del ecosistema y, como mínimo, un paso que falle ante señales críticas. Agrega una auditoría de dependencias programada (semanal), no solo en cada cambio (SB-41).
2. **Despliegue continuo**: construcción del artefacto o imagen una sola vez, despliegue a desarrollo automático tras merge, a pruebas o staging con aprobación, a producción con aprobación y desde una versión etiquetada. Variables por entorno desde la plataforma, nunca en el archivo.
3. **Plantilla de pull request** con la lista de chequeo de `coding-standards.md` y un campo para los IDs de historias.
4. Ejecuta localmente lo que se pueda (por ejemplo, validar la sintaxis del archivo de pipeline o correr las mismas órdenes de build y pruebas).

Pide aprobación antes del commit y antes del push. No hagas merge.

## 5. Reporte `cicd-setup.md`

1. Diagrama del flujo (Mermaid): ramas, pull request, etapas y entornos.
2. Archivos creados y qué hace cada uno.
3. **Pasos manuales para el usuario**, numerados: crear cada secreto (nombre y para qué, sin valor), configurar protección de la rama principal (revisores, checks obligatorios), crear los entornos con aprobadores, permisos de la cuenta de despliegue.
4. Cómo verificar que funciona: abrir un pull request de prueba y qué debería ver.
5. Pendientes y riesgos.

Registra la estrategia de ramas en decisiones si se acaba de decidir.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <desarrollo>/implementation-log.md context-pack/infrastructure.md context-pack/tech-policy.md \
             context-pack/coding-standards.md context-pack/security.md \
             context-pack/validation-tools.md context-pack/environments.md \
  --oq <OQ creadas> --resumen "<plataforma>, <N> etapas, <M> pasos manuales"
```

Resume: qué quedó configurado, la lista de pasos manuales y el estado de la rama.
