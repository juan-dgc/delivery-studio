# Estimación de precio y pagos

Si el material no trae precios, estímalos tú. Todas las cifras salen de `scripts/estimar.py`, nunca de un cálculo a mano: así cada cifra que aparece en varias secciones es idéntica y cada total es la suma de sus partes.

## Cómo estimar

1. Divide el trabajo en fases y componentes, alineados con los módulos `MOD-NN` de `scope.md` y, si existe, con el backlog de historias.
2. Estima las horas de cada componente pensando en un equipo de 3 ingenieros senior: arquitectura y backend, frontend y producto, integración y pruebas. Usa `commercial.md` si define otro equipo.
3. Precio de cada componente = horas por tarifa, redondeado a múltiplos de 100.000 de la moneda (lo hace el script).
4. **Fases definibles hoy:** precio cerrado. **Fases que dependen de hallazgos** (integraciones con sistemas poco conocidos, resultados de una auditoría): "se ratifican al terminar la Fase 0", o paquetes de horas adicionales de mínimo 40 horas, con precio igual a 40 por la tarifa.
5. Muestra siempre el subtotal antes de IVA, el IVA y el total.

## Pagos por hitos (valores de referencia)

| Tipo | Pagos |
|---|---|
| Descubrimiento | 100 % al aceptar el alcance |
| Construcción | 30, 40 y 30 % (al iniciar, al entregar la versión de pruebas, en la puesta en marcha), o 40, 30 y 30 % en proyectos cortos |
| Integraciones y módulos | 40 y 60 % (al iniciar y al aprobar las pruebas) |
| Auditorías | 50 y 50 % (al iniciar y al entregar el informe) |
| Paquetes de horas | 50 y 50 % |

- Cambios fuera del alcance: tarifa por hora, con aprobación previa por escrito.
- Cuando una opción tiene mejor valor que otra, ancla el precio de forma natural: presenta primero la recomendada y muestra cuánto baja el valor si se omite un módulo.

## Uso del script

Escribe `estimacion-entrada.json` en la carpeta de la corrida (el formato está en el encabezado de `scripts/estimar.py`) y ejecuta:

```bash
python3 <esta skill>/scripts/estimar.py <carpeta>/estimacion-entrada.json --salida <carpeta>
```

Produce:

- `estimacion.json`: todas las cifras. Copia de aquí cada cifra a la propuesta.
- `estimacion-interna.md`: tablas por fase y componente, pagos, modelos de pago y los formatos listos para prosa, tarjeta y tabla.

Si cambias horas o tarifas, vuelve a ejecutarlo y actualiza el HTML con las cifras nuevas.

## Hoja interna

`estimacion-interna.md` se complementa con la ficha de hechos y los supuestos de estimación (qué incluye cada componente, por qué esas horas, riesgos que justifican la contingencia). No se envía al cliente.
