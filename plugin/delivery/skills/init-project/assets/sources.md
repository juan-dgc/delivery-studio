# Fuentes externas

Lista aquí lo que `/delivery:ingest-sources` debe consultar además de los archivos de `inputs/`.
Borra las líneas de ejemplo. No escribas contraseñas ni tokens en este archivo.

## Repositorios

<!-- Una línea por repositorio: URL o ruta local | propósito | rama -->
- ejemplo: https://github.com/empresa/repo | backend actual | main

## Jira

<!-- Proyecto o consulta JQL y qué se busca -->
- ejemplo: project = ABC AND type in (Epic, Story) | épicas e historias actuales

## Aplicaciones en funcionamiento

<!-- Si el sistema ya existe, la URL de un entorno de pruebas o desarrollo para recorrerlo en solo lectura | qué módulos -->
- ejemplo: https://qa.empresa.com | inicio de sesión, recuperar contraseña

## Otros enlaces

<!-- Documentación pública, Confluence, Figma, etc. -->
- ejemplo: https://empresa.atlassian.net/wiki/spaces/ABC | documentación funcional
