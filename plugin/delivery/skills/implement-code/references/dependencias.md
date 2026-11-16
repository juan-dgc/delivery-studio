# Guía: dependencias

Cómo decidir qué librerías usa el proyecto, proponerlas, instalarlas y dejarlas registradas. En un repositorio existente del cliente se usa lo que ya tiene; una librería nueva ahí siempre requiere aprobación.

## Orden de preferencia

1. Lo que ya trae el lenguaje o el framework.
2. Lo que ya está instalado en el repositorio.
3. Lo que `tech-policy.md` aprueba.
4. Una librería nueva, con aprobación.

Una dependencia nueva es código de terceros que el proyecto tendrá que actualizar y auditar durante toda su vida. Por eso se justifica cada una.

## Cómo evaluar una librería nueva

Compruébalo con el gestor de paquetes o el registro del ecosistema en el momento, no de memoria:

- **Resuelve la necesidad** sin traer mucho más de lo que se usa.
- **Mantenida**: versiones recientes, soporte para la versión del lenguaje y del framework del proyecto.
- **Adoptada**: uso amplio y documentación suficiente.
- **Licencia compatible** con lo que `constraints.md` o `tech-policy.md` permitan. Ante una licencia con obligaciones de publicación de código, pregunta antes.
- **Sin vulnerabilidades altas o críticas abiertas** en la versión que se instala.
- **Tamaño razonable** para el frontend: una librería grande para una función pequeña no se justifica.

Si no puedes comprobar alguno de estos puntos (sin red), dilo en la propuesta en vez de asumirlo.

## Necesidades habituales

Lista para no olvidar ninguna al arrancar. La librería concreta sale de `tech-policy.md` o de la evaluación; los nombres entre paréntesis son opciones conocidas de cada ecosistema, no una recomendación fija.

| Necesidad | Aplica a | Qué buscar | Control |
|---|---|---|---|
| Validación de datos | Backend y formularios | Esquemas declarativos que validen y tipen (Zod, Joi, class-validator, Pydantic, FluentValidation, Bean Validation) | SB-17 |
| Acceso a datos | Backend | ORM o constructor de consultas con parámetros y migraciones (Prisma, Drizzle, TypeORM, SQLAlchemy con Alembic, Entity Framework, JPA con Flyway o Liquibase) | SB-15 |
| Autenticación | Backend | Preferir el proveedor o la librería que la arquitectura defina; no escribir criptografía propia | SB-07, SB-08 |
| Hash de contraseñas | Backend, si no hay proveedor | Argon2 o bcrypt del ecosistema | SB-07 |
| Cabeceras de seguridad y CORS | Backend web | Middleware estándar del framework (Helmet y cors en Node, los integrados de Django, ASP.NET o Spring Security) | SB-26, SB-27 |
| Límite de peticiones | Backend | Middleware de límite por ruta y por origen | SB-24 |
| Registro de eventos | Backend | Registro estructurado (Pino, Winston, structlog, Serilog, Logback) | SB-35 |
| Configuración | Todos | Lectura y validación de variables de entorno al arrancar | SB-01 |
| Cliente HTTP | Frontend e integraciones | El nativo del entorno si basta; una librería si se necesitan interceptores o reintentos | |
| Estado del servidor | Frontend | Caché y sincronización de datos de la API (TanStack Query, SWR, RTK Query, Apollo) | |
| Estado de la interfaz | Frontend | Lo mínimo: el del framework; una librería solo si hay estado global real | |
| Formularios | Frontend | Manejo de formularios integrado con la validación por esquemas | |
| Componentes de interfaz | Frontend | La librería que decida el design system (`ux.libreria_componentes`) | |
| Fechas y dinero | Todos | Librería de fechas con zonas horarias; decimales exactos para dinero, nunca punto flotante | |
| Internacionalización | Frontend | Solo si `constraints.md` pide más de un idioma | |
| Pruebas unitarias | Todos | El framework estándar del ecosistema (Vitest o Jest, pytest, xUnit, JUnit) y su librería de simulaciones | |
| Pruebas de componentes | Frontend | Testing Library del framework | |
| Pruebas de API | Backend | Cliente de pruebas del framework (Supertest, el cliente de pruebas de FastAPI o Django, WebApplicationFactory, MockMvc) | |
| Lint y formato | Todos | ESLint y Prettier, Ruff, los analizadores de .NET, Checkstyle o Spotless | |
| Documentación de la API | Backend | Generación o validación contra el contrato OpenAPI del paso 07a | |
| Tareas en segundo plano | Backend | Solo si la arquitectura define colas o tareas programadas | |

## Cómo presentar la propuesta

Una tabla, antes de instalar nada:

| Necesidad | Librería | Por qué esta | Alternativa considerada | Licencia | Tipo | Controles |
|---|---|---|---|---|---|---|
| Validación de datos | Zod | Esquemas que también dan los tipos; ya aprobada en tech-policy | Joi: no genera tipos | MIT | producción | SB-17 |

Marca cuáles están en `tech-policy.md` y cuáles son nuevas. Las nuevas necesitan aprobación explícita. Si el usuario pregunta por qué no otra, responde con la diferencia que importa para este proyecto, no con una comparación general.

## Instalar

Con aprobación, y mostrando antes el comando:

| Ecosistema | Instalar una dependencia | De desarrollo | Instalar desde el bloqueo | Auditar |
|---|---|---|---|---|
| npm | `npm install <paquete>` | `npm install -D <paquete>` | `npm ci` | `npm audit` |
| pnpm | `pnpm add <paquete>` | `pnpm add -D <paquete>` | `pnpm install --frozen-lockfile` | `pnpm audit` |
| yarn | `yarn add <paquete>` | `yarn add -D <paquete>` | `yarn install --immutable` | `yarn npm audit` |
| Python con pip | `pip install <paquete>` y fijarlo en `requirements.txt` | en `requirements-dev.txt` | `pip install -r requirements.txt` | `pip-audit` |
| Python con Poetry o uv | `poetry add <paquete>` / `uv add <paquete>` | `--group dev` / `--dev` | `poetry install` / `uv sync` | `pip-audit` |
| .NET | `dotnet add package <paquete>` | igual, en el proyecto de pruebas | `dotnet restore` | `dotnet list package --vulnerable` |
| Java con Maven o Gradle | Agregar al `pom.xml` o `build.gradle` | con alcance de prueba | `mvn verify` / `gradle build` | plugin de comprobación de dependencias |
| Go | `go get <paquete>` | igual | `go mod download` | `govulncheck ./...` |

Reglas:

- Siempre dentro del proyecto, con un entorno aislado cuando el ecosistema lo usa (entorno virtual en Python). Nunca instalación global.
- El archivo de bloqueo se guarda en el repositorio. No mezcles gestores: uno solo por proyecto (`desarrollo.gestor_paquetes`).
- Versiones fijadas. No uses rangos abiertos ni "la última" en el archivo de dependencias.
- Después de instalar: auditar, compilar y correr las pruebas. Una vulnerabilidad alta o crítica en producción se resuelve antes de seguir.
- No ejecutes scripts de instalación de paquetes que no conoces sin revisarlos, ni agregues registros o fuentes de paquetes distintos a los del proyecto.
- Sin red o sin permiso para instalar: agrega la dependencia al archivo, deja el comando exacto para el usuario y marca la verificación como pendiente. No simules que se instaló.

## Registrar

En `implementation-log.md`, sección "Dependencias agregadas": librería, versión instalada, necesidad, tipo, quién la aprobó y resultado de la auditoría. Las que condicionan el resto del proyecto (acceso a datos, componentes, framework de pruebas) se registran además como decisión `desarrollo.<necesidad>`. Si una librería aprobada no está en `tech-policy.md`, registra una pregunta abierta con destino `tech-policy.md` para que el documento quede al día.
