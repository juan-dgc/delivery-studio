---
name: design-integration
description: "Diseña la integración con un sistema externo (paso 07b, una corrida por integración INT-NN): flujos y secuencia, mapeo de datos campo a campo, autenticación, manejo de errores, reintentos, idempotencia, límites del tercero, monitoreo, ambiente sandbox y un plan de pruebas con simulador del servicio y pruebas de contrato. Deja visible lo que falta pedirle al tercero. Úsala después de la arquitectura, para cada sistema de integrations.md."
disable-model-invocation: true
argument-hint: "[INT-01 o nombre del sistema]"
---

# Diseño de una integración

> **Requiere antes:** `/delivery:design-architecture`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **ingeniero de integraciones senior**. Tu misión: diseñar cada integración para que funcione cuando el tercero falla, y dejar claro qué hay que pedirle a ese tercero.

Te importa:

- Diseñar para la falla: tiempos de espera, reintentos, idempotencia.
- Mapeo de datos campo a campo, sin suposiciones.
- Probar sin depender del tercero, con un simulador.
- Una lista de pendientes con el tercero que se pueda enviar tal cual.

Las integraciones concentran el riesgo de casi todos los proyectos: dependen de un tercero que no controlas, con documentación incompleta, ambientes de prueba inestables y tiempos de respuesta ajenos. Un diseño sólido responde de antemano tres preguntas: qué datos van y vienen exactamente, qué pasa cuando el otro lado falla, y cómo se prueba sin depender de él. Esta skill trabaja una integración por corrida, porque cada una tiene su propio ritmo y sus propios interlocutores.

Sigue `.pipeline/protocolo.md`. El alcance de la corrida es la integración: `int-01`, `int-02`, etc.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 07b-integrations
python3 .pipeline/scripts/pipeline.py run latest 07-architecture proyecto
python3 .pipeline/scripts/pipeline.py run latest 07a-api-contracts proyecto
```

Lee la integración en `integrations.md`, su sección en `architecture.md` y las evidencias que la mencionan (documentación del tercero, ejemplos de mensajes). Si no vino como argumento, lista las `INT-NN` y cuáles ya tienen diseño (`outputs/07b-integrations/`), y pregunta cuál trabajar.

## 2. Preguntar lo que falte

Solo lo que no esté en la evidencia:

1. Si existe documentación técnica del tercero (API, archivos, eventos) y dónde está. Sin ella el diseño saldrá con muchos `[POR CONFIRMAR]`, y eso está bien: es la lista de lo que hay que pedir.
2. Si hay ambiente sandbox y quién da los accesos.
3. **Criticidad**: si el sistema puede seguir operando cuando el tercero no responde (degradado, en cola) o debe bloquearse.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 07b-integrations <int-NN>
```

## 4. Diseñar `integration-<int-NN>.md`

1. **Resumen**: sistema, propósito, dirección, patrón (API síncrona, webhooks, eventos, archivos programados), criticidad y dueño del lado del tercero.
2. **Flujos**: uno por caso de uso, con diagrama de secuencia en Mermaid y las historias que atiende.
3. **Contrato**: endpoints o mensajes del tercero que se usan, con su formato. Si el tercero llama al sistema (webhooks), el contrato de entrada se agrega a los contratos de API del paso 07a.
4. **Mapeo de datos**: tabla campo origen | campo destino | transformación | obligatorio | regla (`RN-NNN`). Incluye catálogos y códigos a traducir.
5. **Autenticación y secretos**: mecanismo, rotación y dónde viven las credenciales (nombres de variables, nunca valores).
6. **Errores y resiliencia**: tabla por tipo de falla (tiempo de espera, 4xx, 5xx, datos inválidos, duplicado) | detección | reacción | reintento (cuántos, con qué espera) | registro y alerta. Idempotencia para que un reintento no duplique efectos. Cola o reintento diferido si la criticidad lo permite. Corte de circuito si el tercero cae seguido.
7. **Límites**: cuotas, tamaño de mensajes, horarios de mantenimiento, tiempos de respuesta acordados.
8. **Monitoreo**: qué se registra (sin datos sensibles), métricas y alertas.
9. **Pruebas**:
   - Simulador del servicio del tercero (por ejemplo WireMock, Prism o uno propio) con los escenarios de éxito y de cada falla de la tabla 6.
   - Pruebas de contrato que comprueban que lo que se envía y recibe cumple el formato acordado.
   - Pruebas contra el sandbox, cuáles y con qué datos.
   Agrega los casos de prueba que falten como OQ hacia el paso 03.
10. **Pendientes con el tercero**: lista concreta de preguntas y accesos a solicitar, lista para enviar.

Registra cada vacío como OQ con destino `integrations.md` y, si cambia el alcance o el esfuerzo, menciónalo en el contexto para que la cotización lo refleje.

## 5. Modo REGENERAR

Cuando llegue la documentación o las respuestas del tercero (ingeridas como evidencia o respondidas con `/delivery:open-questions`), reemplaza los `[POR CONFIRMAR]` correspondientes y documenta los cambios.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <arquitectura>/architecture.md context-pack/integrations.md context-pack/security.md \
             context-pack/infrastructure.md context-pack/data-model.md context-pack/constraints.md \
  --oq <OQ creadas> --resumen "<INT-NN> <sistema>: <patrón>, <N> flujos, <P> pendientes con el tercero"
```

Resume: patrón, riesgos principales, pendientes con el tercero y el siguiente paso (otra integración, o `/delivery:design-db-schema`).
