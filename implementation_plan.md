---
description: Plan de implementación secuencial para el Bot Sincronización Programada Telegram -> NodeBB (v1.0)
---
# Plan de Implementación Secuencial
# Bot Sincronización Programada Telegram -> NodeBB

**Versión:** 1.0
**Fecha:** 2025-04-19

## Introducción

Este documento describe el plan paso a paso para implementar el bot de sincronización, basado en `requisitos_sincronizacion.md`. Cada paso representa una unidad lógica de trabajo que nos acerca a la solución final.

## Fases y Pasos de Implementación

**Fase 1: Configuración y Estructura del Proyecto**

*   **Paso 1.1: Inicialización de Firebase y Dependencias**
    *   **Objetivo:** Establecer la estructura base del proyecto Firebase Functions e instalar las librerías necesarias.
    *   **Requisitos Relacionados:** Entorno de ejecución (RNF04, RNF05).
    *   **Tareas:**
        *   Navegar a la raíz del proyecto.
        *   Ejecutar `firebase login` (si no se ha hecho).
        *   Ejecutar `firebase use TU_PROJECT_ID`.
        *   Ejecutar `firebase init functions` (seleccionando JavaScript o TypeScript, y configurando ESLint/Prettier si se desea).
        *   Ejecutar `firebase init firestore` (creando archivo de reglas `firestore.rules` y índices `firestore.indexes.json`).
        *   Navegar a la carpeta `functions/`.
        *   Instalar dependencias: `npm install firebase-admin firebase-functions @google-cloud/secret-manager axios` (o `node-fetch` si se prefiere a `axios`).
        *   Instalar dependencias de desarrollo (opcional): `npm install -D eslint prettier`.
    *   **Archivos Involucrados:** `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `functions/package.json`, `functions/node_modules/`.
    *   **Verificación:** Comandos `firebase init` completados. `package.json` actualizado con dependencias.

*   **Paso 1.2: Definir Estructura de Código Modular**
    *   **Objetivo:** Crear la estructura de archivos para separar responsabilidades dentro de `functions/`.
    *   **Requisitos Relacionados:** Mantenibilidad (RNF04).
    *   **Tareas:**
        *   Dentro de `functions/`, crear archivos vacíos:
            *   `config.js` (para manejar configuración y secretos).
            *   `telegramApi.js` (para interactuar con la API de Telegram).
            *   `nodebbApi.js` (para interactuar con la API de NodeBB).
            *   `firestoreService.js` (para interactuar con Firestore).
            *   `messageParser.js` (para lógica de filtrado y extracción).
        *   En `functions/index.js`, limpiar el código de ejemplo y añadir imports básicos para los nuevos módulos y `firebase-functions`.
    *   **Archivos Involucrados:** `functions/index.js`, `functions/config.js`, `functions/telegramApi.js`, `functions/nodebbApi.js`, `functions/firestoreService.js`, `functions/messageParser.js`.
    *   **Verificación:** Archivos creados. `index.js` tiene imports básicos.

**Fase 2: Implementación de Módulos Centrales**

*   **Paso 2.1: Implementar Configuración y Secretos (`config.js`)**
    *   **Objetivo:** Crear funciones para leer variables de entorno y acceder a secretos.
    *   **Requisitos Relacionados:** RF08, RNF03 (Seguridad).
    *   **Tareas:**
        *   En `config.js`:
            *   Importar `SecretManagerServiceClient`.
            *   Crear función `getConfig()` que lea y devuelva un objeto con todas las variables de entorno necesarias (TARGET_CHAT_ID, NODEBB_URL, etc., usando valores por defecto si aplica).
            *   Crear función asíncrona `getSecrets(secretNames)` que reciba un array de nombres de secretos (ej: [TELEGRAM_BOT_TOKEN_SECRET_NAME]) y devuelva un objeto con los valores de esos secretos obtenidos de Secret Manager.
            *   Manejar errores si las variables de entorno o secretos no están definidos/accesibles.
    *   **Archivos Involucrados:** `functions/config.js`.
    *   **Verificación:** Funciones exportadas. Pruebas unitarias (si se configuran) o pruebas locales simulando variables de entorno y acceso a Secret Manager (requiere autenticación `gcloud`).

*   **Paso 2.2: Implementar Servicio Firestore (`firestoreService.js`)**
    *   **Objetivo:** Crear funciones para interactuar con la colección de tracking en Firestore.
    *   **Requisitos Relacionados:** RF03, RF06, 3.2 (Modelo de Datos).
    *   **Tareas:**
        *   En `firestoreService.js`:
            *   Importar `firebase-admin` e inicializar (`admin.initializeApp(); admin.firestore();`).
            *   Obtener el nombre de la colección desde `config.js` o usar un valor por defecto.
            *   Crear función asíncrona `checkIfProcessed(messageId)` que consulte Firestore por el ID del documento y devuelva `true` si existe, `false` si no.
            *   Crear función asíncrona `markAsProcessed(messageId, chatId, status, nodebbTopicId = null)` que escriba un documento en Firestore con los datos proporcionados.
    *   **Archivos Involucrados:** `functions/firestoreService.js`.
    *   **Verificación:** Funciones implementadas. Pruebas locales usando emulador de Firestore o contra Firestore real (con cuidado).

*   **Paso 2.3: Implementar API Telegram (`telegramApi.js`)**
    *   **Objetivo:** Crear función para obtener mensajes recientes.
    *   **Requisitos Relacionados:** RF02.
    *   **Tareas:**
        *   En `telegramApi.js`:
            *   Importar `axios` o `node-fetch`.
            *   Crear función asíncrona `getRecentMessages(botToken, chatId, daysAgo = 3)` que:
                *   Calcule el timestamp de `daysAgo`.
                *   Llame al método `getUpdates` (o similar) de la API de Bot de Telegram (URL: `https://api.telegram.org/bot<TOKEN>/...`).
                *   Filtre los resultados por `message.chat.id` y `message.date`.
                *   Devuelva el array de objetos `Message` filtrados.
                *   Maneje errores de la API.
    *   **Archivos Involucrados:** `functions/telegramApi.js`.
    *   **Verificación:** Pruebas locales llamando a la función con un token y chat ID válidos.

*   **Paso 2.4: Implementar Parseador de Mensajes (`messageParser.js`)**
    *   **Objetivo:** Filtrar y extraer datos de los mensajes de Telegram.
    *   **Requisitos Relacionados:** RF03, RF04.
    *   **Tareas:**
        *   En `messageParser.js`:
            *   Crear función `parseMessage(message, targetHashtags)` que:
                *   Verifique si `message.text` existe.
                *   Verifique la presencia de al menos un `targetHashtag` (insensible a mayúsculas).
                *   Busque la línea `Titulo: ` (sensible a mayúsculas).
                *   Extraiga el título (si no está vacío) y el contenido (excluyendo la línea del título).
                *   Extraiga `message.from.username` (o nombre) y `message.date`.
                *   Devuelva `{ title, content, user, date, messageId: message.message_id }` si es válido, o `null` si no.
            *   Crear función auxiliar para formatear la fecha/hora (ej: DD/MM/AAAA HH:MM).
    *   **Archivos Involucrados:** `functions/messageParser.js`.
    *   **Verificación:** Pruebas unitarias con diferentes ejemplos de mensajes (válidos, inválidos, sin título, sin hashtag, etc.).

*   **Paso 2.5: Implementar API NodeBB (`nodebbApi.js`)**
    *   **Objetivo:** Crear función para publicar temas en NodeBB.
    *   **Requisitos Relacionados:** RF05.
    *   **Tareas:**
        *   En `nodebbApi.js`:
            *   Importar `axios` o `node-fetch`.
            *   Crear función asíncrona `createNodebbTopic(nodebbUrl, apiToken, categoryId, title, content)` que:
                *   Construya la URL del endpoint de la API de NodeBB (ej: `${nodebbUrl}/api/v3/topics`).
                *   Construya el payload JSON (`{ cid, title, content }`).
                *   Realice la llamada POST con la cabecera `Authorization: Bearer <apiToken>`.
                *   Devuelva el ID del topic creado si la llamada es exitosa, o lance/maneje un error si falla.
    *   **Archivos Involucrados:** `functions/nodebbApi.js`.
    *   **Verificación:** Pruebas locales (con precaución) contra una instancia de NodeBB (quizás de desarrollo) o mockear la API.

**Fase 3: Orquestación y Despliegue**

*   **Paso 3.1: Implementar Función Principal (`index.js`)**
    *   **Objetivo:** Unir todos los módulos en la función programada.
    *   **Requisitos Relacionados:** RF01-RF07.
    *   **Tareas:**
        *   En `index.js`:
            *   Definir la función `syncTelegramToNodeBB` usando `functions.pubsub.schedule().timeZone().onRun(...)`.
            *   Especificar `runWith({ secrets: [...] })` para los tokens.
            *   Dentro de `onRun`:
                1.  Llamar a `getConfig()` y `getSecrets()`.
                2.  Llamar a `getRecentMessages()`.
                3.  Iterar sobre los mensajes:
                    a.  Llamar a `checkIfProcessed()`.
                    b.  Si no procesado, llamar a `parseMessage()`.
                    c.  Si parseado correctamente:
                        i.  Llamar a `createNodebbTopic()`. Registrar éxito/fallo.
                        ii. Llamar a `markAsProcessed()` con el estado correspondiente y el ID del topic si hubo éxito.
                    d.  Si no se parsea, registrar y continuar.
                    e.  Si ya estaba procesado, saltar.
                4.  Implementar logging detallado en cada paso (RF07).
                5.  Asegurar manejo de errores global (try/catch) para la ejecución completa.
    *   **Archivos Involucrados:** `functions/index.js`.
    *   **Verificación:** Pruebas locales forzando la ejecución de la función (puede requerir emuladores o configuración local completa con autenticación gcloud).

*   **Paso 3.2: Configuración Final y Despliegue**
    *   **Objetivo:** Desplegar la función configurada en Firebase/GCP.
    *   **Requisitos Relacionados:** Todos. Guía `deploy.md`.
    *   **Tareas:**
        *   Revisar la configuración de `firebase.json` (runtime, región, etc.).
        *   Asegurarse de que los secretos están en Secret Manager.
        *   Ejecutar el comando `firebase deploy --only functions:syncTelegramToNodeBB --set-env-vars ...` (como se describe en `deploy.md`), proporcionando todas las variables de entorno necesarias.
        *   Verificar la creación del job en Cloud Scheduler.
    *   **Archivos Involucrados:** Consola de GCP/Firebase.
    *   **Verificación:** Despliegue exitoso. Job de Cloud Scheduler creado. Función visible en Cloud Functions.

*   **Paso 3.3: Pruebas End-to-End**
    *   **Objetivo:** Validar el flujo completo en el entorno desplegado.
    *   **Requisitos Relacionados:** Todos.
    *   **Tareas:**
        *   Enviar mensajes de prueba (válidos e inválidos) al grupo de Telegram.
        *   Forzar la ejecución desde Cloud Scheduler o esperar a la ejecución programada.
        *   Verificar:
            *   Creación de temas en NodeBB para mensajes válidos.
            *   Ausencia de temas para mensajes inválidos o ya procesados.
            *   Registros correctos en Firestore (`processedTelegramMessages`).
            *   Logs detallados y sin errores inesperados en Cloud Logging.
    *   **Archivos Involucrados:** Telegram, NodeBB, Consola GCP/Firebase (Firestore, Logging, Scheduler).
    *   **Verificación:** El sistema funciona según lo especificado en los requisitos.

--- 