---
description: Especificación detallada de requisitos para el Bot Sincronización Programada Telegram -> NodeBB (v1.0)
globs: 
alwaysApply: false
---
# Especificación de Requisitos de Software (SRS)
# Bot Sincronización Programada Telegram -> NodeBB

**Versión:** 1.0
**Fecha:** 2025-04-19

## Tabla de Contenidos
1. Introducción
    1.1. Propósito
    1.2. Alcance
    1.3. Definiciones, Acrónimos y Abreviaturas
    1.4. Referencias
    1.5. Resumen del Documento
2. Descripción General
    2.1. Perspectiva del Producto
    2.2. Funciones del Producto
    2.3. Características de los Usuarios
    2.4. Restricciones Generales
    2.5. Suposiciones y Dependencias
3. Requisitos Específicos
    3.1. Requisitos Funcionales
    3.2. Requisitos de Datos (Firestore)
    3.3. Requisitos de Interfaz Externa
    3.4. Requisitos No Funcionales

---

## 1. Introducción

### 1.1. Propósito
Este documento define los requisitos completos para el **Bot Sincronización Programada Telegram -> NodeBB**. Su objetivo es detallar las funcionalidades, restricciones, interfaces y criterios de calidad del software a desarrollar, sirviendo como guía para el desarrollo, pruebas y mantenimiento. La implementación se realizará utilizando **Firebase Cloud Functions**, **Cloud Scheduler**, **Cloud Firestore**, y **Google Secret Manager**.

### 1.2. Alcance
El software será una **Firebase Cloud Function programada** que:
* Se ejecuta periódicamente (diariamente a las 9:00 AM).
* Obtiene mensajes recientes (últimos 3 días) de un grupo específico de Telegram.
* Identifica mensajes candidatos basados en la presencia de **hashtags de una whitelist** (insensible a mayúsculas) y una línea de **"Titulo: "** (sensible a mayúsculas).
* Filtra mensajes ya procesados utilizando un registro en **Cloud Firestore**.
* Extrae el título y contenido del mensaje.
* Crea **nuevos temas (topics)** en una categoría específica de un foro **NodeBB**, utilizando el título y contenido extraídos.
* Registra el ID del mensaje procesado en **Cloud Firestore** para evitar duplicados.

**Fuera del Alcance:**
* Sincronización en tiempo real (no usa webhooks).
* Sincronización de ediciones o eliminaciones de mensajes de Telegram.
* Mapeo de usuarios entre Telegram y NodeBB (publica con un usuario bot configurado).
* Sincronización de archivos adjuntos o formato complejo más allá de Markdown básico.
* Gestión de la lista de hashtags o configuración de NodeBB a través de comandos de Telegram (se realiza mediante configuración/variables de entorno).
* Creación de *tags* en NodeBB basados en los hashtags de Telegram.

### 1.3. Definiciones, Acrónimos y Abreviaturas
* **Bot:** La aplicación de software descrita en este documento.
* **SRS:** Especificación de Requisitos de Software (este documento).
* **Telegram:** Plataforma de mensajería instantánea.
* **NodeBB:** Software de foro basado en Node.js.
* **API:** Interfaz de Programación de Aplicaciones.
* **Hashtag:** Etiqueta precedida por `#`.
* **Whitelist:** Lista predefinida de hashtags permitidos (`TARGET_HASHTAGS`).
* **`message_id`:** Identificador numérico único de un mensaje dentro de un chat de Telegram.
* **`chat_id`:** Identificador numérico único de un chat (grupo) de Telegram.
* **RF:** Requisito Funcional.
* **RNF:** Requisito No Funcional.
* **Firebase:** Plataforma de desarrollo de aplicaciones de Google.
* **Cloud Function:** Servicio de cómputo sin servidor de Firebase/GCP.
* **Cloud Scheduler:** Servicio de GCP para programar trabajos cron.
* **Firestore:** Base de datos NoSQL de documentos de Firebase/GCP.
* **Secret Manager:** Servicio de GCP para almacenar secretos.
* **GCP:** Google Cloud Platform.
* **UTC:** Tiempo Universal Coordinado.
* **Markdown:** Lenguaje de marcado ligero.

### 1.4. Referencias
* `README.md` (versión actualizada del proyecto).
* Documentación API de Bot de Telegram: [https://core.telegram.org/bots/api](mdc:https:/core.telegram.org/bots/api)
* Documentación API de NodeBB (Write API): Se debe consultar la documentación específica de la instancia NodeBB o la documentación general ([https://docs.nodebb.org/api/write/](mdc:https:/docs.nodebb.org/api/write)).
* Documentación de Firebase/GCP (Cloud Functions, Firestore, Scheduler, Secret Manager).

### 1.5. Resumen del Documento
Este documento describe el propósito y alcance (Sección 1), la perspectiva general del producto (Sección 2), y finalmente detalla los requisitos específicos funcionales, de datos, de interfaz y no funcionales (Sección 3).

## 2. Descripción General

### 2.1. Perspectiva del Producto
El bot es un componente de integración backend que opera sin interacción directa del usuario final. Se ejecuta como una tarea programada en la nube (Firebase/GCP) y actúa como puente entre un grupo de Telegram y un foro NodeBB, automatizando la creación de contenido en el foro basado en mensajes específicos de Telegram. Depende de las APIs externas de Telegram y NodeBB y de los servicios de Firebase/GCP para su operación.

### 2.2. Funciones del Producto
1.  **Ejecución Programada:** Iniciada por Cloud Scheduler.
2.  **Recolección de Datos:** Obtención de mensajes recientes de Telegram.
3.  **Filtrado y Validación:** Identificación de mensajes candidatos (hashtag, "Titulo:", no procesado).
4.  **Procesamiento de Contenido:** Extracción de título y cuerpo del mensaje. Formateo a Markdown.
5.  **Sincronización:** Creación de nuevos temas en NodeBB vía su API.
6.  **Tracking de Estado:** Registro de mensajes procesados en Firestore.
7.  **Manejo de Errores y Logging:** Registro de operaciones y fallos en Cloud Logging.

### 2.3. Características de los Usuarios
* **Administradores:** Responsables de configurar (secrets, variables de entorno), desplegar la Cloud Function, configurar el Cloud Scheduler, y monitorizar el sistema. No interactúan directamente con el bot en ejecución, salvo para la configuración inicial y mantenimiento.
* **Usuarios del Grupo Telegram:** Crean los mensajes que *potencialmente* serán sincronizados si cumplen los criterios (uso de hashtag y "Titulo:"). Son la fuente de los datos.
* **Usuarios del Foro NodeBB:** Consumen el contenido sincronizado desde Telegram.

### 2.4. Restricciones Generales
* **Plataforma:** Implementación exclusiva en Firebase/GCP (Functions, Firestore, Scheduler, Secret Manager).
* **Dependencia de APIs:** Funcionalidad limitada por las capacidades, límites de tasa y disponibilidad de las APIs de Telegram y NodeBB.
* **Ventana de Recuperación:** La estrategia de obtener mensajes de los últimos 3 días implica posible pérdida de datos si el sistema falla por un periodo más largo.
* **Autenticación NodeBB:** Requiere un Token de API válido (preferiblemente de Usuario) con permisos para crear temas en la categoría especificada.
* **Formato de Mensaje:** Rígida dependencia del formato "Titulo: " (sensible a mayúsculas) para la extracción del título.
* **Entorno de Ejecución:** Limitaciones de Cloud Functions (tiempo de ejecución, memoria, etc.).
* **Costes:** Asociados al uso de Firebase/GCP.

### 2.5. Suposiciones y Dependencias
* Se dispone de acceso y permisos para gestionar recursos en un proyecto Firebase/GCP.
* La API de NodeBB está habilitada, es accesible desde Cloud Functions, y se dispone de un token válido.
* El bot de Telegram tiene permisos para leer mensajes en el grupo objetivo.
* La estructura de datos devuelta por las APIs de Telegram y NodeBB es consistente.
* Los administradores configuran correctamente los secretos y variables de entorno.

## 3. Requisitos Específicos

### 3.1. Requisitos Funcionales

**RF01: Ejecución Programada**
* **Descripción:** La función principal debe ser invocada automáticamente por Cloud Scheduler.
* **Activador:** Evento de Cloud Scheduler.
* **Frecuencia:** Diariamente a las 09:00 (zona horaria configurable, defecto UTC).
* **Entrada:** Contexto de ejecución proporcionado por Cloud Functions/Scheduler.
* **Salida:** Inicio del proceso de sincronización.
* **Criterios de Aceptación:** La función se ejecuta puntualmente según la programación definida.

**RF02: Obtención de Mensajes Recientes de Telegram**
* **Descripción:** La función debe solicitar a la API de Telegram los mensajes del grupo configurado (`TARGET_CHAT_ID`) enviados en los últimos 3 días.
* **Interfaz:** API de Bot de Telegram (Método `getUpdates` o similar, gestionando offset o filtrando por fecha).
* **Entrada:** Token del Bot de Telegram (de Secret Manager), `TARGET_CHAT_ID`.
* **Proceso:** Realizar llamada(s) a la API para obtener mensajes. Manejar paginación si es necesario. Filtrar mensajes cuya fecha (`message.date`) sea posterior a (now - 3 días).
* **Salida:** Array de objetos `Message` de Telegram correspondientes a los últimos 3 días.
* **Manejo de Errores:** Registrar errores si la API falla o devuelve un error. Finalizar ejecución controladamente si no se pueden obtener mensajes.
* **Criterios de Aceptación:** Se obtienen todos los mensajes del chat especificado dentro del rango temporal.

**RF03: Identificación y Filtrado de Mensajes Candidatos**
* **Descripción:** Iterar sobre los mensajes obtenidos (RF02) y aplicar filtros para seleccionar candidatos.
* **Entrada:** Array de objetos `Message`, lista `TARGET_HASHTAGS` (de configuración), conexión a Firestore.
* **Proceso:** Para cada mensaje:
    1.  Verificar si el `message_id` ya existe en la colección de tracking de Firestore (RF05). Si existe, descartar.
    2.  Verificar si el `message.text` contiene al menos un hashtag de `TARGET_HASHTAGS`. La comparación debe ser **insensible a mayúsculas/minúsculas**.
    3.  Verificar si el `message.text` contiene al menos una línea que comience **exactamente** con `Titulo: ` (sensible a mayúsculas, con espacio).
    4.  Si cumple los 3 criterios, el mensaje es candidato.
* **Salida:** Array de objetos `Message` candidatos para procesamiento.
* **Criterios de Aceptación:** El filtrado selecciona correctamente solo los mensajes que cumplen todas las condiciones. La consulta a Firestore es eficiente.

**RF04: Procesamiento de Contenido del Mensaje**
* **Descripción:** Para cada mensaje candidato, extraer la información necesaria para NodeBB.
* **Entrada:** Objeto `Message` candidato.
* **Proceso:**
    1.  **Extraer Título:** Buscar la **primera** línea que empiece con `Titulo: `. El texto restante de esa línea es el título. Eliminar espacios en blanco al inicio/final. Si el texto después de `Titulo: ` está vacío o solo contiene espacios, descartar el mensaje como inválido.
    2.  **Extraer Contenido:** Obtener todo el texto del mensaje (`message.text`) **excluyendo** la línea completa del título identificada en el paso anterior.
    3.  **Extraer Usuario:** Obtener `message.from.username` o `message.from.first_name` / `last_name`.
    4.  **Extraer Fecha:** Obtener `message.date` (timestamp Unix).
    5.  **Formatear Contenido NodeBB:** Construir el cuerpo del post. Incluir el contenido extraído (paso 2). Añadir una línea con la información del autor y fecha (ej: `Publicado por @{username} el {DD/MM/AAAA HH:MM}`). El contenido extraído debe interpretarse como Markdown por NodeBB.
* **Salida:** Objeto estructurado conteniendo: `tituloNodeBB`, `contenidoNodeBB`, `messageIdTelegram`.
* **Criterios de Aceptación:** El título y contenido se extraen correctamente según las reglas. El mensaje de origen inválido (título vacío) se descarta. El formato final del contenido es el esperado.

**RF05: Creación de Tema en NodeBB**
* **Descripción:** Para cada mensaje procesado (RF04), crear un nuevo tema en NodeBB.
* **Interfaz:** API de NodeBB (Write API, endpoint para crear temas, ej: `/api/v3/topics`).
* **Entrada:** Objeto procesado (`tituloNodeBB`, `contenidoNodeBB`), configuración de NodeBB (`NODEBB_URL`, `NODEBB_CATEGORY_ID`, Token API de NodeBB de Secret Manager).
* **Proceso:** Realizar una llamada POST a la API de NodeBB con los datos necesarios: `cid` (ID de categoría), `title` (título), `content` (contenido formateado). Incluir el Token API en las cabeceras (`Authorization: Bearer <TOKEN>`).
* **Salida:** Resultado de la llamada a la API de NodeBB (éxito o error).
* **Manejo de Errores:** Registrar errores si la API de NodeBB falla (ej: 401, 403, 500, timeout).
* **Criterios de Aceptación:** Se crea un nuevo tema en la categoría correcta de NodeBB con el título y contenido esperados. La autenticación funciona.

**RF06: Actualización de Estado (Tracking)**
* **Descripción:** Registrar en Firestore que un mensaje ha sido procesado para evitar duplicados.
* **Interfaz:** Firestore.
* **Entrada:** `messageIdTelegram` del mensaje procesado.
* **Proceso:** **Después** de intentar la creación en NodeBB (RF05), **independientemente del resultado (éxito o fallo)**, añadir un nuevo documento a la colección de tracking en Firestore. El ID del documento puede ser el `message_id` (como string) o un ID autogenerado conteniendo el `message_id` en un campo. Incluir un timestamp de procesamiento.
* **Salida:** Documento creado/actualizado en Firestore.
* **Manejo de Errores:** Registrar errores si la escritura en Firestore falla.
* **Criterios de Aceptación:** El `message_id` se registra correctamente en Firestore tras el intento de publicación.

**RF07: Manejo General de Errores y Logging**
* **Descripción:** Registrar información relevante y errores durante la ejecución.
* **Interfaz:** Cloud Logging.
* **Proceso:** Usar `console.log`, `console.error` o `functions.logger` para registrar:
    * Inicio y fin de la ejecución de la función.
    * Número de mensajes obtenidos de Telegram.
    * Número de mensajes candidatos identificados.
    * Número de temas intentados crear en NodeBB (y cuántos con éxito/fallo).
    * Detalles específicos de cualquier error de API (Telegram, NodeBB, Firestore, Secret Manager).
* **Salida:** Logs estructurados en Cloud Logging.
* **Criterios de Aceptación:** Logs suficientes para depurar problemas y monitorizar la ejecución.

### 3.2. Requisitos de Datos (Firestore)

* **Colección:** `processedTelegramMessages` (o nombre configurable).
* **Propósito:** Almacenar los IDs de los mensajes de Telegram que ya han sido procesados (o intentados procesar) para evitar duplicidad.
* **Estructura del Documento:**
    * **ID del Documento:** Usar el `message_id` de Telegram convertido a String.
    * **Campos:**
        * `processedAt`: Timestamp (Firestore Timestamp) - Momento en que se registró.
        * `chatId`: Number (o String) - `chat_id` del grupo de origen (útil para posible extensión futura).
        * `nodebbTopicId` (Opcional): Number - ID del tema creado en NodeBB si la creación fue exitosa.
        * `status` (Opcional): String ('success', 'error_nodebb', 'error_firestore') - Estado del intento de procesamiento.
* **Indexación:** Firestore indexa automáticamente los campos. El acceso primario será por ID del documento (clave primaria), lo cual es eficiente.
* **Reglas de Seguridad:** Configurar para permitir escritura solo desde la cuenta de servicio de la Cloud Function (usando Admin SDK). No permitir acceso público ni de cliente.

### 3.3. Requisitos de Interfaz Externa

* **Interfaz 1: Cloud Scheduler**
    * **Propósito:** Activar la Cloud Function periódicamente.
    * **Mecanismo:** Configuración de un Job en Cloud Scheduler apuntando a la Cloud Function (Pub/Sub o HTTP target).
* **Interfaz 2: API de Bot de Telegram (Lectura)**
    * **Propósito:** Obtener mensajes recientes.
    * **Mecanismo:** Llamadas HTTPS GET/POST desde la Cloud Function a `api.telegram.org`.
    * **Métodos:** `getUpdates` u otro método adecuado.
    * **Autenticación:** Token del Bot (obtenido de Secret Manager).
* **Interfaz 3: API de NodeBB (Escritura)**
    * **Propósito:** Crear nuevos temas en el foro.
    * **Mecanismo:** Llamadas HTTPS POST desde la Cloud Function al endpoint de la API Write de NodeBB.
    * **Métodos:** Endpoint para crear temas (`/api/vX/topics`).
    * **Autenticación:** Token API NodeBB (obtenido de Secret Manager) en cabecera `Authorization: Bearer`.
* **Interfaz 4: Cloud Firestore (Lectura/Escritura)**
    * **Propósito:** Consultar y registrar IDs de mensajes procesados.
    * **Mecanismo:** Firebase Admin SDK dentro de la Cloud Function.
    * **Operaciones:** Lectura por ID (`get`), Escritura (`set` o `add`).
* **Interfaz 5: Google Secret Manager (Lectura)**
    * **Propósito:** Obtener secretos (Tokens de API de Telegram y NodeBB).
    * **Mecanismo:** SDK de Secret Manager dentro de la Cloud Function.
    * **Operaciones:** `accessSecretVersion`.
* **Interfaz 6: Cloud Logging (Escritura)**
    * **Propósito:** Registrar logs de ejecución y errores.
    * **Mecanismo:** SDK de Cloud Logging (implícito vía `console` o `functions.logger`).

### 3.4. Requisitos No Funcionales

* **RNF01: Rendimiento:**
    * La ejecución completa de la función para un volumen típico de mensajes debería completarse dentro del timeout de Cloud Functions (configurable, pero evitar ejecuciones excesivamente largas).
    * Las llamadas a APIs externas (Telegram, NodeBB) deben tener timeouts razonables para evitar bloqueos.
    * Las consultas a Firestore deben ser eficientes (acceso por ID es óptimo).
* **RNF02: Fiabilidad:**
    * El sistema debe manejar correctamente los errores esperados de las APIs (ej: NodeBB no disponible temporalmente) sin perder el estado (el mensaje se marcará como procesado pero se registrará el error).
    * Debe ser resiliente a mensajes malformados (ej: título vacío tras "Titulo: ").
    * Utilizar logging adecuado para diagnosticar fallos.
* **RNF03: Seguridad:**
    * Los Tokens de API (Telegram, NodeBB) DEBEN almacenarse en Google Secret Manager.
    * La cuenta de servicio de la Cloud Function debe tener los permisos IAM mínimos necesarios (acceso a Secret Manager, Firestore, Logging).
    * Las Reglas de Seguridad de Firestore deben restringir el acceso únicamente a la función backend.
    * No exponer secretos en logs ni en el código fuente.
* **RNF04: Mantenibilidad:**
    * El código debe estar bien estructurado (ej: separar lógica de Telegram, NodeBB, Firestore) y documentado.
    * La configuración (IDs, nombres de secretos, hashtags) debe ser externa al código (variables de entorno, configuración de la función).
    * Facilitar la actualización de dependencias y el redespliegue.
* **RNF05: Escalabilidad:**
    * La solución debe poder manejar un aumento razonable en el volumen de mensajes del grupo de Telegram, dentro de los límites de Cloud Functions y las APIs externas. Firestore escala automáticamente.
    * Considerar posible refactorización a múltiples funciones o Pub/Sub si el procesamiento se vuelve muy largo o complejo en el futuro. 