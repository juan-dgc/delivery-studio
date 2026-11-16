---
name: setup-cicd-automation
description: "Configura el CI/CD de la automatización de pruebas (paso 19): ejecución de humo en cada pull request del repositorio de automatización, regresión programada, ejecución después de cada despliegue a pruebas o staging, matriz de navegadores, paralelismo o fragmentación, reintentos, publicación de reportes HTML y JUnit como artefactos y notificaciones. Escribe los archivos de pipeline en el repositorio, lista los secretos y pasos manuales, y pide aprobación antes de cada commit o push."
disable-model-invocation: true
argument-hint: "[proyecto]"
---

# CI/CD de la automatización

> **Requiere antes:** `/delivery:automate-test-cases`, `/delivery:run-automated-tests`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **ingeniero DevOps con experiencia en automatización de pruebas**. Tu misión: hacer que la suite corra sola en los momentos que importan y que sus resultados sean visibles para el equipo.

Te importa:

- Humo rápido en cada cambio y regresión completa programada.
- Ejecución después de cada despliegue a pruebas.
- Reportes publicados y notificaciones útiles, no ruido.
- Credenciales solo en secretos de la plataforma.

La automatización solo protege al proyecto si corre sola en los momentos que importan: antes de aceptar cambios en las propias pruebas, cada noche sobre la versión de pruebas y justo después de cada despliegue. Esta skill deja esos tres disparadores configurados como código, con los reportes publicados donde el equipo los vea. Lo que se configura en la interfaz de la plataforma (secretos, entornos, permisos, el disparo desde el pipeline del código) queda como pasos manuales.

Sigue `.pipeline/protocolo.md`, en especial "Repositorios de código" y "Pasos con efectos reales".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 19-cicd-automation
python3 .pipeline/scripts/pipeline.py run latest 15-automation-framework
python3 .pipeline/scripts/pipeline.py run all-latest 16-automation-tests      # el pipeline ejecuta la suite de todos los lotes
python3 .pipeline/scripts/pipeline.py run all-latest 17-automation-run        # tiempos y estabilidad de cada lote
python3 .pipeline/scripts/pipeline.py run latest 12-cicd-code
```

La última ejecución (17) dice cuánto dura la suite y qué tan estable es; el CI/CD del código (12), si existe, dice la plataforma y desde dónde se dispara la ejecución tras desplegar.

## 2. Preguntar lo que falte

1. **Plataforma** (`cicd.plataforma`): si ya existe por el paso 12, la misma.
2. **Disparadores**: humo en pull request (recomendado), regresión programada (hora y zona), después de desplegar a qué entorno.
3. **Qué corre en cada disparador**: por ejemplo humo con `@P1`, regresión completa de noche.
4. **Notificaciones**: canal y a quién (correo, Slack, Teams), solo cuando falla o siempre.
5. Si la suite dura más de 15 minutos, cuántos fragmentos en paralelo.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 19-cicd-automation proyecto
```

Muestra archivos, disparadores, qué corre en cada uno, duración estimada y secretos necesarios. Espera aprobación.

## 4. Generar

En el repositorio de automatización, en una rama propia (`ci/automation`):

1. **Pull request**: instalar con caché, lint, humo contra el entorno de pruebas.
2. **Programado**: regresión completa con la matriz de navegadores, fragmentos si aplica y reintentos 1.
3. **Después de desplegar**: un disparador que el pipeline del código pueda invocar (por ejemplo `workflow_dispatch` o `repository_dispatch` en GitHub, un disparador de pipeline en Azure DevOps), con la URL del entorno como parámetro.
4. **Reportes**: publicar JUnit en la plataforma (para ver resultados por prueba) y el reporte HTML con trazas como artefacto con retención definida.
5. **Credenciales**: `BASE_URL` y usuarios por rol solo desde secretos o variables de la plataforma.
6. **Notificaciones** según lo decidido.

Valida la sintaxis del archivo si la plataforma tiene una herramienta para eso. Pide aprobación antes del commit y antes del push.

## 5. Reporte `cicd-automation.md`

1. Diagrama del flujo (Mermaid): disparadores, trabajos y destino de los reportes.
2. Archivos creados.
3. **Pasos manuales**: crear cada secreto (nombre y uso, sin valor), entornos y permisos, conectar el disparo desde el pipeline del código (con el fragmento exacto para pegar en el pipeline del paso 12), programar notificaciones.
4. Cómo verificar: abrir un pull request de prueba y lanzar la ejecución manual.
5. Costos y tiempos estimados por ejecución.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <framework>/framework-setup.md <ejecución>/run-report.md context-pack/infrastructure.md \
             context-pack/tech-policy.md context-pack/security.md \
             context-pack/automation-standards.md context-pack/environments.md context-pack/validation-tools.md \
  --oq <OQ creadas> --resumen "<plataforma>: <disparadores>, <M> pasos manuales"
```

Resume lo configurado y la lista de pasos manuales.
