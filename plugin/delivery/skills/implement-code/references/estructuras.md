# Guía: arrancar el proyecto

Cómo crear la estructura inicial según el tipo de proyecto y el stack. Orden de autoridad: la sección "Estructura de repositorios" de `architecture.md`, luego `tech-policy.md` y `coding-standards.md`, luego las convenciones del framework, y por último esta guía. En un repositorio existente del cliente no se aplica nada de aquí: se sigue lo que hay.

## Principios

- **Generador oficial primero.** Cada framework tiene su herramienta para crear proyectos. Úsala: produce la configuración que el framework espera y que su documentación asume. Escribir esos archivos a mano deja proyectos que casi funcionan.
- **Organizar por funcionalidad.** Dentro de la estructura del framework, el código del negocio se agrupa por módulo del dominio (`MOD-NN` de `scope.md`: `cotizaciones/`, `clientes/`), no por tipo de archivo. Cada módulo lleva juntos su lógica, su acceso a datos, sus pantallas o rutas y sus pruebas.
- **Lo compartido, aparte y pequeño.** Una carpeta para lo transversal (configuración, autenticación, errores, utilidades, componentes base). Si crece mucho, algo del dominio se coló ahí.
- **Las pruebas junto al código que prueban**, o en la carpeta que el framework usa por convención. Las pruebas de punta a punta de la automatización (paso 15) viven en su propio repositorio o carpeta, no aquí.
- **Nada vacío por si acaso.** Se crean las carpetas de los módulos del primer sprint y la base. Los demás módulos se crean cuando su historia llega.
- **Versiones comprobadas.** La versión de cada herramienta se toma de `tech-policy.md`; si no la fija, la estable vigente con soporte, comprobada con el gestor de paquetes en el momento. Nunca de memoria.

## Tipos de proyecto

Elige el tipo por lo que dice la arquitectura. El comando del generador se muestra al usuario y se ejecuta con aprobación.

### Aplicación web de una página (SPA)

Interfaz que consume una API separada.

| Stack | Generador oficial | Estructura base |
|---|---|---|
| React con Vite | `npm create vite@latest <nombre> -- --template react-ts` | `src/` con `app/` (arranque, rutas, proveedores), `modulos/<modulo>/` (pantallas, componentes, api, pruebas), `compartido/` (componentes base, cliente HTTP, utilidades), `estilos/` |
| Vue | `npm create vue@latest` | `src/` con `router/`, `stores/`, `modulos/<modulo>/`, `components/` (base), `services/` |
| Angular | `npx @angular/cli new <nombre>` | `src/app/` con `core/` (servicios únicos, interceptores, guardias), `shared/`, `features/<modulo>/` |

Con TypeScript, salvo que `tech-policy.md` diga otra cosa.

### Web con renderizado en servidor o aplicación completa

Interfaz y servidor en el mismo proyecto.

| Stack | Generador oficial | Estructura base |
|---|---|---|
| Next.js | `npx create-next-app@latest` | `app/` (rutas y disposición), `modulos/<modulo>/` (componentes, acciones del servidor, acceso a datos, pruebas), `lib/` (configuración, autenticación, base de datos), `components/ui/` |
| Nuxt | `npx nuxi@latest init <nombre>` | `pages/`, `server/api/`, `composables/`, `components/`, y módulos por funcionalidad |
| Django | `django-admin startproject` y `python manage.py startapp <modulo>` | Proyecto de configuración, una aplicación por módulo del dominio, `templates/`, `static/` |
| Rails, Laravel | `rails new`, `composer create-project laravel/laravel` | La convención del framework, sin cambiarla |

### API o servicio

Backend que expone una API.

| Stack | Generador oficial | Estructura base |
|---|---|---|
| Node con NestJS | `npx @nestjs/cli new <nombre>` | `src/` con un módulo de Nest por módulo del dominio (controlador, servicio, repositorio, DTO, pruebas), `common/` (filtros, guardias, interceptores), `config/` |
| Node con Express o Fastify | No hay generador único: `npm init` y estructura propia | `src/` con `modulos/<modulo>/` (rutas, controlador, servicio, repositorio, esquemas, pruebas), `middleware/`, `config/`, `db/` (migraciones), `app` y `server` separados para poder probar |
| Python con FastAPI | Sin generador oficial: gestor de proyectos del ecosistema | `app/` con `modulos/<modulo>/` (router, esquemas, servicio, repositorio), `core/` (configuración, seguridad, errores), `db/`, `tests/`, migraciones |
| .NET | `dotnet new webapi -n <Nombre>` y `dotnet new sln` | Solución con proyectos por capa (Api, Aplicación, Dominio, Infraestructura) y pruebas, o carpetas por funcionalidad si la arquitectura pide un monolito simple |
| Java con Spring Boot | Spring Initializr (`start.spring.io`, también por línea de comandos) | Paquete por módulo del dominio con `controller`, `service`, `repository`, `dto`; `config`; recursos y migraciones |
| Go | `go mod init` | `cmd/<app>/`, `internal/<modulo>/`, `internal/platform/` (base de datos, configuración), migraciones |

Capas dentro de cada módulo (detalle en `api-backend.md`): entrada (rutas o controladores), lógica de negocio, acceso a datos. La lógica de negocio no conoce HTTP ni SQL.

### Aplicación móvil

| Stack | Generador oficial | Estructura base |
|---|---|---|
| React Native con Expo | `npx create-expo-app@latest` | `app/` (rutas), `modulos/<modulo>/`, `compartido/` |
| Flutter | `flutter create <nombre>` | `lib/` con `features/<modulo>/` (presentación, dominio, datos), `core/` |

### Varios proyectos en un repositorio (monorepo)

Cuando la arquitectura define un solo repositorio con frontend y backend. Estructura: `apps/web/`, `apps/api/`, `packages/` para lo compartido (tipos del contrato, configuración de lint), y los espacios de trabajo del gestor de paquetes. Cada aplicación se crea con su propio generador dentro de `apps/`. No agregues una herramienta de orquestación de monorepos si no está en `tech-policy.md`: con dos aplicaciones, los espacios de trabajo del gestor bastan.

## La base que todo proyecto necesita

Antes de la primera historia. Marca en el registro cada punto como hecho, no aplica (motivo) o pendiente (motivo).

| # | Qué | Detalle |
|---|---|---|
| 1 | Control de versiones | `.gitignore` del ecosistema, que excluya `.env`, dependencias, compilados y archivos del editor. Rama inicial según `repositorio.modelo_ramas` |
| 2 | Configuración por ambiente | Un solo módulo que lee y valida la configuración al arrancar y falla con un mensaje claro si falta algo. `.env.example` con todas las variables, sin valores, con un comentario por variable. Nombres de ambientes según `environments.md` |
| 3 | Lint y formato | La herramienta estándar del ecosistema, con la configuración de `coding-standards.md`. Un comando para comprobar y otro para corregir |
| 4 | Tipos | Comprobación estricta de tipos si el lenguaje la tiene |
| 5 | Pruebas unitarias | Framework configurado, un comando para correrlas, reporte de cobertura y una prueba de ejemplo que pasa |
| 6 | Base de datos | Conexión por configuración, herramienta de migraciones lista y una primera migración vacía o con las tablas base de `schema.sql`. Nunca cambios de esquema hechos a mano |
| 7 | Errores | Manejador global que registra el detalle y devuelve al cliente un mensaje sin información interna (SB-34), con el formato de error del contrato si hay paso 07a |
| 8 | Registro de eventos | Registro estructurado con nivel por ambiente, sin contraseñas, tokens ni datos personales (SB-35) |
| 9 | Autenticación y autorización | La base definida en la arquitectura y en la revisión de seguridad: middleware o guardia que exige autenticación por defecto, con una lista explícita de rutas públicas (SB-08, SB-38), y un punto único donde se comprueban permisos en el servidor (SB-40) |
| 10 | Validación de entradas | Librería de esquemas configurada, y validación en el borde del servidor (SB-17) |
| 11 | Seguridad web | Cabeceras de seguridad y CORS con lista de orígenes desde la configuración (SB-26, SB-27). Límite de peticiones en autenticación (SB-24) |
| 12 | Cliente de API (frontend) | Un solo cliente HTTP con la URL base desde la configuración, manejo de errores y de sesión. Ningún componente llama a la red directamente |
| 13 | Diseño (frontend) | Tokens y componentes base del design system (paso 05) conectados; convención de `data-testid` lista |
| 14 | Salud | Punto de comprobación que responde si la aplicación y sus dependencias están arriba, sin exponer detalles |
| 15 | Scripts | Comandos con nombres estándar para instalar, arrancar en desarrollo, compilar, probar, lint y migrar, en el archivo de scripts del ecosistema |
| 16 | README | Requisitos, cómo instalar, configurar, arrancar, probar y migrar; estructura de carpetas con su propósito; cómo se nombra una rama y un commit |
| 17 | Datos de ejemplo | Si `test-data-policy.md` lo permite, un script de datos sintéticos para desarrollo. Nunca datos reales |
| 18 | Contenedor | Solo si `infrastructure.md` o la arquitectura lo piden: archivo de imagen y de composición local con la base de datos |

No va en la base: el pipeline de CI/CD (lo hace el paso 12, que lee los scripts del punto 15) ni las pruebas de punta a punta (paso 15).

## Verificar el arranque

En este orden, y deteniéndose en el primer fallo:

1. Instalar dependencias desde cero.
2. Compilar o comprobar tipos.
3. Lint.
4. Pruebas unitarias.
5. Arrancar en modo desarrollo y pedir el punto de salud o abrir la pantalla inicial.
6. Si hay base de datos local disponible, correr las migraciones.

Anota el resultado de cada paso en el registro, con el comando exacto. Lo que no se pudo ejecutar en este entorno queda como pendiente con su comando, no como hecho.
