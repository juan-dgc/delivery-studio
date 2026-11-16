# Guía: backend y APIs

Aplica a servicios que exponen APIs (REST, GraphQL o gRPC) y a procesos de fondo. Si `coding-standards.md` o el código existente dicen otra cosa, mandan ellos.

## Capas

- **Entrada** (controladores, resolvers, manejadores de mensajes): traduce la petición a una llamada del dominio, valida forma y tipos según el contrato, y traduce el resultado o el error a la respuesta del contrato. Sin lógica de negocio.
- **Aplicación o servicios**: casos de uso, uno por operación de negocio. Aquí viven la autorización por registro, las transacciones y la orquestación.
- **Dominio**: entidades y reglas `RN-NNN`, sin dependencias de framework ni de base de datos cuando el tamaño del proyecto lo justifique.
- **Infraestructura**: repositorios de datos, clientes de integraciones (07b), colas, archivos.

## Contrato primero

- El OpenAPI del paso 07a es la fuente de verdad. Genera tipos o validadores desde él si el stack lo permite; si no, escríbelos para que coincidan campo por campo.
- Respuestas de error con el formato acordado (por ejemplo Problem Details) y los códigos definidos en el contrato.
- Agrega una prueba que verifique que la API cumple el contrato (validación de respuestas contra el esquema), si el stack tiene herramienta para eso.

## Validación y reglas

- Valida en la entrada todo lo que el contrato restringe. Valida en el dominio las reglas de negocio aunque la entrada ya haya filtrado: el dominio no confía en quién lo llama.
- Las reglas que el esquema garantiza con restricciones también se manejan en el código, para devolver un error claro en vez de un error de base de datos.

## Seguridad

- Autenticación en un middleware común; autorización en cada caso de uso, verificando rol y propiedad del registro.
- Consultas parametrizadas o el ORM; nunca concatenación de texto con datos del usuario.
- Secretos solo desde variables de entorno o el gestor de secretos definido.
- Registros estructurados con un identificador de correlación por petición, sin datos personales ni secretos.

## Datos

- Migraciones versionadas con la herramienta del proyecto, generadas desde `schema.sql`; una migración por cambio, reversible cuando sea posible.
- Transacciones cuando una operación modifica varias tablas o debe ser atómica.
- Paginación en todos los listados, con el límite que defina el contrato.

## Idempotencia y concurrencia

- Las operaciones que crean o cobran algo aceptan `Idempotency-Key` cuando el contrato lo indica y devuelven el mismo resultado ante un reintento.
- Usa control de concurrencia (versión del registro o bloqueo) cuando dos usuarios puedan modificar lo mismo.

## Integraciones

- Un cliente por sistema externo en infraestructura, con tiempo de espera, reintentos y corte de circuito según el diseño de 07b.
- Pruebas contra el simulador del servicio, nunca contra el sistema real del tercero en las pruebas automáticas.

## Pruebas

- Unitarias para dominio y casos de uso (incluidas las reglas `RN-NNN` y los caminos de error).
- De integración para repositorios y endpoints con una base de datos de prueba aislada.
- Cada prueba prepara y limpia sus datos; ninguna depende del orden.
