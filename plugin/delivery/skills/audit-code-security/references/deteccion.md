# Cómo comprobar cada categoría

Guía para la revisión de juicio. El escáner (`security_scan.py`) da señales por patrón; aquí está lo que hay que leer en el código para confirmar o descartar, y lo que ningún patrón detecta.

## Auditoría de dependencias por ecosistema

Ejecuta la del ecosistema del repositorio, con aprobación (necesita red). Si la herramienta no está instalada, dilo y pregunta antes de instalarla.

| Ecosistema | Comando | Notas |
|---|---|---|
| Node.js (npm) | `npm audit --json` | Con pnpm: `pnpm audit --json`. Con yarn: `yarn npm audit --json` |
| Python | `pip-audit -f json` | Sobre `requirements.txt`: `pip-audit -r requirements.txt` |
| .NET | `dotnet list package --vulnerable --include-transitive` | |
| Java (Maven) | `mvn org.owasp:dependency-check-maven:check` | Lento la primera vez |
| Go | `govulncheck ./...` | |
| Ruby | `bundle audit check --update` | |
| PHP | `composer audit --format=json` | |

Reporta solo las vulnerabilidades de dependencias que se usan en producción con severidad alta o crítica como hallazgos individuales; agrupa el resto.

## 1. Inventario de endpoints (SB-08, SB-38, SB-40)

- Localiza dónde se declaran las rutas: archivos de rutas, controladores, carpetas `api/` o `pages/api/`, funciones del servidor, funciones en el borde, procedimientos remotos.
- Por cada una anota: método, ruta, middleware o guardia de autenticación, comprobación de rol o permiso, y si la comprobación está en el servidor.
- Señales de problema: una ruta sin guardia entre muchas que sí lo tienen; guardias aplicadas ruta por ruta en vez de por defecto; comprobaciones de rol solo en el componente de la interfaz; endpoints de administración, depuración o "internos" sin protección; webhooks que no verifican firma.
- Los públicos legítimos (inicio de sesión, registro, salud, webhooks firmados) se listan como tales.

## 2. Propiedad y acceso a los datos (SB-10 a SB-14, SB-39)

- **Seguridad a nivel de fila**: en Postgres o Supabase, busca en migraciones `enable row level security` y `create policy` por cada tabla. Una tabla sin política, o con una política `using (true)`, está abierta. Si el motor no la soporta, cada consulta debe filtrar por el propietario.
- **Propietario (SB-11)**: recorre el esquema tabla por tabla y marca cuáles guardan datos de usuarios o de clientes. Cada una debe tener una columna de propietario (`user_id`, `owner_id`, `tenant_id`, `organization_id`) con llave foránea y no nula. Después busca en el código cada lectura o escritura sobre esas tablas y comprueba que el filtro por propietario esté en la consulta. Patrones de hallazgo: `findById`, `findUnique`, `get(id)`, `where id = ?`, `.eq('id', id)` sin un segundo filtro por propietario; actualizaciones y borrados por ID sin ese filtro, que son peores porque modifican; consultas que filtran por un propietario que viene del cuerpo o de la URL en vez de la sesión. Una tabla intermedia o hija hereda el problema: si `comentarios` solo apunta a `publicacion_id`, hay que verificar que la consulta suba hasta el dueño de la publicación. Comprobación concreta: toma el endpoint de detalle de cada recurso y responde quién sería el dueño si el ID fuera de otro usuario.
- **Decisión de acceso (SB-12)**: en cada endpoint, identifica de dónde sale la identidad con la que se decide. Debe salir de la sesión verificada en el servidor (token validado, sesión del proveedor de autenticación, contexto de la petición). Es hallazgo crítico si sale del cliente: `req.body.userId`, `req.query.user_id`, `req.params.tenant`, una cabecera como `X-User-Id`, un campo `role` dentro del cuerpo, o un token leído sin verificar la firma. Lo mismo con el rol: debe consultarse en la base de datos o venir en el token verificado, no de un campo que el cliente controla. Señal de alerta en el frontend: si la interfaz envía el ID del usuario en peticiones donde el servidor ya sabe quién es, probablemente el servidor lo está usando. Comprobación concreta: borra mentalmente del cuerpo de la petición todo campo de identidad; si el endpoint ya no sabe para quién trabaja, está decidiendo con datos del cliente.
- **Datos sensibles hacia el cliente (SB-39)**: revisa en tres lugares. Uno, el código que se entrega al navegador: busca claves de servicio, cadenas de conexión, listas de correos, datos de otros usuarios o configuraciones internas incrustadas en el paquete (`dist/`, `.next/`, `build/`), y variables de entorno con prefijo público. Dos, las respuestas de API: compara lo que devuelve cada endpoint con lo que la pantalla necesita; devolver el registro completo del usuario para pintar un nombre expone correo, teléfono, documento o campos internos, y las listas suelen ser peores que el detalle. En marcos con renderizado en el servidor, revisa también el estado inicial que viaja en el HTML (`__NEXT_DATA__`, `window.__INITIAL_STATE__`), que suele llevar el objeto completo. Tres, los registros del navegador: `console.log` de respuestas, tokens o cuerpos de petición que quedan en producción. Un dato personal que el usuario no vería en pantalla no debería llegar al navegador.
- **Campos escribibles**: busca dónde se pasa el cuerpo de la petición directo a crear o actualizar. Debe haber una lista de campos permitidos o un esquema de validación que descarte el resto. Prueba mental: ¿qué pasa si el cliente envía `role`, `user_id`, `price` o `is_admin`?
- **Campos expuestos**: revisa qué devuelve cada respuesta. `select *` o devolver el objeto completo del modelo suele filtrar campos internos.

## 3. Secretos y credenciales (SB-01 a SB-09)

- Confirma cada señal: ¿es un valor real o un ejemplo? ¿Está en código que se entrega al navegador?
- Variables de entorno con prefijo público (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `PUBLIC_`) llegan al cliente: ninguna puede ser una clave secreta o de servicio.
- Revisa el paquete compilado si existe (`dist/`, `.next/`, `build/`): busca ahí los nombres de las claves.
- Sesión: dónde se guarda el token (almacenamiento del navegador o cookie) y con qué atributos se crea la cookie.
- Contraseñas: qué función las transforma. Argon2, bcrypt o scrypt, o un proveedor de autenticación. Comparaciones de contraseña en texto plano o hashes rápidos son hallazgo alto.
- Secreto expuesto: el hallazgo siempre incluye rotar antes de purgar.

## 4. Entradas y salidas (SB-15, SB-17 a SB-23)

- **Consultas**: toda interpolación o concatenación de datos del usuario en SQL, en filtros de un ORM pasados como texto, en comandos del sistema o en rutas de archivos.
- **Validación**: cada endpoint que recibe datos tiene un esquema de validación en el servidor. La validación solo en el formulario no cuenta.
- **Contenido de usuarios**: inserción de HTML sin sanear (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`, filtros que marcan como seguro). Plantillas con el escape desactivado.
- **Redirecciones y URLs**: parámetros como `next`, `redirect`, `url`, `callback` usados para redirigir o para que el servidor haga una petición. Deben validarse contra una lista permitida.
- **Archivos**: validación del tipo por contenido y no solo por extensión, límite de tamaño, nombre generado por el servidor, almacenamiento fuera de la raíz pública, sin ejecución.
- **Listas**: paginación obligatoria y tope máximo del tamaño de página.

## 5. Protección contra ataques (SB-24 a SB-30)

- **Límites de intentos**: middleware o servicio de límite de peticiones en inicio de sesión, recuperación de contraseña, verificación de códigos y endpoints costosos.
- **Bots**: captcha o equivalente en registro y formularios públicos.
- **CORS**: configuración del servidor. Comodín con credenciales, o reflejar cualquier origen, es hallazgo alto.
- **Cabeceras y HTTPS**: pueden venir de la aplicación (middleware de cabeceras) o de la infraestructura (proxy, plataforma). Si no están en el código, es una verificación pendiente en el ambiente, no un hallazgo.

## 6. Costos y operación (SB-31 a SB-37, SB-41)

- **Límites de uso**: llamadas a servicios de pago por uso (IA, mensajería, correo, mapas) sin cuota por usuario ni tope global.
- **Pagos**: el webhook del proveedor verifica la firma; el pedido se marca como pagado solo con confirmación verificada; ante error o duda, no se entrega. Los montos se calculan en el servidor, nunca vienen del cliente.
- **Agentes y automatizaciones**: qué credenciales usan y qué pueden borrar o modificar. Deben tener el mínimo permiso y pedir confirmación para operaciones destructivas o masivas.
- **Errores**: manejador global de errores que no devuelve trazas ni mensajes internos. Mensajes de inicio de sesión que no revelan si la cuenta existe.
- **Registro**: se registran eventos de seguridad, y no se registran contraseñas, tokens ni datos sensibles.
- **Respaldos, restauración, eliminación real y revisión periódica**: casi nunca se ven en el código. Son verificaciones pendientes con el cliente.

## Correspondencia con OWASP Top 10

| OWASP | Controles |
|---|---|
| A01 Control de acceso roto | SB-08, SB-10 a SB-14, SB-38, SB-40 |
| A02 Fallas criptográficas | SB-06, SB-07, SB-28, SB-29 |
| A03 Inyección | SB-15, SB-17, SB-18 |
| A04 Diseño inseguro | SB-09, SB-24, SB-25, SB-31, SB-32, SB-33 |
| A05 Configuración de seguridad incorrecta | SB-26, SB-27, SB-34 |
| A06 Componentes vulnerables | SB-30, SB-41 |
| A07 Fallas de identificación y autenticación | SB-05, SB-06, SB-07, SB-09, SB-24 |
| A08 Fallas de integridad de software y datos | SB-21, SB-22, SB-32 |
| A09 Fallas de registro y monitoreo | SB-16, SB-35 |
| A10 Falsificación de peticiones del lado del servidor | SB-20 |
