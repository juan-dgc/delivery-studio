# Línea base de seguridad

Lista única de controles de seguridad del pipeline. Sirve para **prevenir** y para **corregir** con la misma vara:

- Las skills que diseñan (arquitectura, contratos, esquema, revisión de seguridad) la usan para que el diseño ya nazca con los controles.
- `/delivery:implement-code` la aplica al escribir cada historia y deja un autochequeo en su registro.
- `/delivery:review-code` y `/delivery:audit-code-security` verifican contra esta misma lista. Así una auditoría no falla por algo que nadie le pidió al desarrollo.

Cómo leerla:

- Cada control tiene un ID estable (`SB-NN`) para citarlo en el código, en los registros y en los hallazgos.
- **Aplica** dice cuándo corresponde. Un control que no aplica al proyecto se declara "No aplica: motivo", no se ignora.
- Las reglas propias del proyecto están en `context-pack/security.md` y **mandan sobre esta lista**: pueden endurecer un control, agregar otros o, con su fuente, exceptuar uno.
- Es una línea base alineada con OWASP Top 10, no un reemplazo de una prueba de penetración ni de una asesoría legal o de cumplimiento.

## 1. Credenciales y secretos

| ID | Control | Aplica | Cómo se verifica |
|---|---|---|---|
| SB-01 | Las claves de API, tokens y contraseñas de servicios nunca están en el código ni en el frontend: se leen de variables de entorno o de un gestor de secretos. | Siempre | Búsqueda de patrones de secretos en el código y en el paquete que se entrega al navegador |
| SB-02 | No hay secretos en Git ni en su historial. `.env` y similares están en `.gitignore` y existe un `.env.example` sin valores. | Siempre | Escaneo del árbol y del historial; revisión de `.gitignore` |
| SB-03 | Si un secreto se filtró, primero se rota (se emite uno nuevo y se despliega), luego se revoca el anterior y por último se purga del historial. Nunca al revés. | Cuando se detecta un secreto expuesto | Registro del incidente con los tres pasos en orden |
| SB-04 | En el cliente solo se usan claves públicas o de alcance limitado (por ejemplo la clave anónima de la base de datos). Las claves de servicio o administración solo viven en el servidor. | Cuando el cliente habla con la base de datos o con terceros | Qué clave carga el frontend y qué permisos tiene |
| SB-05 | Los tokens de sesión no se guardan en `localStorage` ni `sessionStorage`. | Aplicaciones web con sesión | Búsqueda de escrituras de tokens en almacenamiento del navegador |
| SB-06 | Las cookies de sesión llevan `HttpOnly`, `Secure` y `SameSite`, con expiración definida. | Aplicaciones web con sesión por cookie | Atributos de la cookie al iniciar sesión |
| SB-07 | Las contraseñas se guardan con un hash adaptativo y con sal (Argon2, bcrypt o scrypt), o su gestión se delega en un proveedor de autenticación. Nunca en texto plano ni con hashes rápidos (MD5, SHA-1, SHA-256 sin estiramiento). | Cuando el sistema maneja contraseñas | Código de registro y de cambio de contraseña |
| SB-08 | La autenticación se comprueba en el servidor en cada petición. Ocultar una pantalla o un botón no es un control. | Siempre | Petición directa al endpoint sin sesión o con sesión vencida |
| SB-09 | Existe segundo factor de autenticación, al menos para roles administrativos y operaciones sensibles. | Sistemas con datos sensibles, dinero o roles administrativos | Flujo de inicio de sesión y configuración del proveedor |

## 2. Base de datos y control de acceso

| ID | Control | Aplica | Cómo se verifica |
|---|---|---|---|
| SB-10 | Seguridad a nivel de fila (RLS) activada en todas las tablas expuestas al cliente, con políticas explícitas. Si el motor no la soporta, el control equivalente está en el servidor en cada consulta. | Siempre que haya datos por usuario o por organización | Listado de tablas con RLS y de sus políticas; consulta con un usuario ajeno |
| SB-11 | Cada registro tiene un propietario (usuario u organización) y las consultas filtran por él. | Datos por usuario o multiempresa | Columnas de propietario en el esquema; acceso a un registro ajeno cambiando el ID |
| SB-12 | El acceso a cada registro se decide por los permisos del usuario autenticado, no por lo que envía el cliente. | Siempre | Petición con el ID de un recurso de otro usuario o de otro rol |
| SB-13 | Hay una lista explícita de los campos que el cliente puede escribir. Campos como rol, propietario, saldo, precio o estado no se aceptan desde el cliente. | Toda operación de creación o edición | Envío de campos de más en el cuerpo de la petición |
| SB-14 | Las respuestas exponen solo los campos necesarios. Nunca hashes de contraseña, tokens ni datos internos. | Toda respuesta de API | Revisión de las respuestas y de los serializadores |
| SB-15 | Todas las consultas usan parámetros. Nunca se arma SQL concatenando datos del usuario. | Siempre que haya base de datos | Búsqueda de concatenación o interpolación en consultas |
| SB-16 | Las consultas a la base de datos se monitorean: lentas, fallidas y volúmenes anormales. | Sistemas en producción | Configuración de registro y de alertas de la base |

## 3. Validación y protección de datos

| ID | Control | Aplica | Cómo se verifica |
|---|---|---|---|
| SB-17 | Toda entrada se valida en el servidor (tipo, formato, longitud, rango), aunque el cliente ya la valide. | Siempre | Petición directa con datos inválidos |
| SB-18 | El contenido que viene de usuarios se escapa o codifica al mostrarlo. No se inserta HTML sin sanear. | Aplicaciones que muestran contenido de usuarios | Búsqueda de inserción de HTML sin sanear; prueba con una carga de script |
| SB-19 | Las respuestas declaran su tipo de contenido y su codificación correctos. | Siempre | Cabeceras de las respuestas |
| SB-20 | Los enlaces, redirecciones y referencias que controla el usuario se comprueban contra una lista de destinos permitidos. | Cuando hay redirecciones, URLs o referencias enviadas por el usuario | Redirección a un dominio externo; URL hacia la red interna |
| SB-21 | La subida de archivos limita tipo real, tamaño y cantidad. | Cuando hay subida de archivos | Subida de un tipo no permitido y de un archivo enorme |
| SB-22 | Los archivos subidos se renombran, se guardan fuera de la raíz pública y nunca se ejecutan. | Cuando hay subida de archivos | Dónde y con qué nombre quedan; acceso directo por URL |
| SB-23 | Las respuestas de la API están limitadas: paginación obligatoria y tamaño máximo. | APIs que devuelven listas | Petición sin límite o con un límite enorme |

## 4. Protección contra ataques y accesos indebidos

| ID | Control | Aplica | Cómo se verifica |
|---|---|---|---|
| SB-24 | Los intentos de inicio de sesión, de recuperación de contraseña y de códigos de verificación están limitados por cuenta y por origen. | Sistemas con autenticación propia | Intentos repetidos hasta el bloqueo |
| SB-25 | Hay protección contra bots donde se crean cuentas y en formularios públicos. | Registro abierto o formularios públicos | Envío automatizado del formulario |
| SB-26 | CORS es restrictivo: lista de orígenes permitidos, sin comodín cuando hay credenciales. | APIs consumidas desde un navegador | Configuración de CORS; petición desde otro origen |
| SB-27 | Se envían cabeceras de seguridad: política de contenido, protección contra enmarcado, `X-Content-Type-Options` y política de referencia. | Aplicaciones web | Cabeceras de la respuesta principal |
| SB-28 | Todo el tráfico va por HTTPS y HTTP redirige. | Siempre que haya despliegue | Petición por HTTP |
| SB-29 | HSTS habilitado. | Aplicaciones web desplegadas | Cabecera `Strict-Transport-Security` |
| SB-30 | Las dependencias se escanean en busca de vulnerabilidades conocidas, en cada cambio y de forma periódica. | Siempre | Auditoría de dependencias del ecosistema; paso en el pipeline de CI |

## 5. Costos, operación y comportamiento del sistema

| ID | Control | Aplica | Cómo se verifica |
|---|---|---|---|
| SB-31 | Hay límites de uso por usuario y globales en lo que cuesta dinero: llamadas a IA, mensajería, almacenamiento, servicios de terceros. | Cuando se consumen servicios de pago por uso | Configuración de cuotas y de alertas de gasto |
| SB-32 | Los pagos fallan de forma segura: ante un error, una respuesta dudosa o una notificación sin firma válida, no se entrega el producto ni se marca como pagado. | Cuando hay pagos | Qué pasa si el proveedor no responde o la firma no coincide |
| SB-33 | Ninguna automatización ni agente de IA puede borrar o modificar datos de forma masiva sin autorización explícita. Las credenciales de los agentes tienen el mínimo permiso. | Cuando hay agentes, automatizaciones o IA con acceso a datos | Permisos de las credenciales que usan; confirmaciones exigidas |
| SB-34 | Los mensajes de error que ve el usuario no revelan trazas, consultas, rutas, versiones ni si una cuenta existe. | Siempre | Forzar errores y leer la respuesta |
| SB-35 | Hay registro de eventos de seguridad (accesos, fallos de autenticación, cambios de permisos, operaciones sensibles) sin datos sensibles, y alertas sobre lo anormal. | Sistemas en producción | Configuración de registro y de alertas |
| SB-36 | Los respaldos existen y la restauración se ha probado. | Sistemas en producción | Fecha y resultado de la última prueba de restauración |
| SB-37 | La eliminación de datos es real: cubre copias, archivos asociados y servicios de terceros, o hay un borrado lógico con plazo de purga definido. | Cuando el usuario puede eliminar datos o lo exige la regulación | Qué queda después de eliminar un registro |

## 6. Revisión general

| ID | Control | Aplica | Cómo se verifica |
|---|---|---|---|
| SB-38 | Cada endpoint exige las credenciales que le corresponden. Los públicos son una lista explícita y corta. | Siempre | Inventario de endpoints con su requisito de autenticación |
| SB-39 | Ningún dato sensible llega al frontend si no es indispensable: ni en el código, ni en el paquete, ni en respuestas, ni en registros del navegador. | Aplicaciones web y móviles | Revisión del paquete y de las respuestas |
| SB-40 | Los permisos se validan en el servidor para cada acción, no solo en la interfaz. | Siempre | Ejecutar la acción con un rol que no debería poder |
| SB-41 | La configuración de seguridad y las dependencias se revisan de forma periódica, con responsable y fecha. | Sistemas en producción | Evidencia de la última revisión |

## Niveles de un hallazgo

Cuando un control no se cumple, el hallazgo se clasifica así, salvo que `context-pack/test-severity-priority.md` defina otra escala:

- **Crítico**: permite tomar control de cuentas o datos, mover dinero, o expone secretos activos. Ejemplos: SB-01, SB-02, SB-08, SB-10, SB-12, SB-15 incumplidos.
- **Alto**: expone datos de otros usuarios o facilita un ataque conocido. Ejemplos: SB-05, SB-07, SB-13, SB-18, SB-26, SB-32.
- **Medio**: debilita una defensa sin exposición directa. Ejemplos: SB-24, SB-27, SB-29, SB-34.
- **Bajo**: higiene y operación. Ejemplos: SB-16, SB-41.

Crítico y alto bloquean una entrega a producción.
