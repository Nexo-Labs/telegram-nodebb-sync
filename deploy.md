---
description: Guía de despliegue y configuración local para el Bot Sincronización Programada Telegram -> NodeBB (v1.0)
globs: 
alwaysApply: false
---
# Guía de Despliegue y Configuración Local
# Bot Sincronización Programada Telegram -> NodeBB

**Versión:** 1.0
**Fecha:** 2025-04-19

## 1. Introducción

Este documento describe el proceso para configurar un entorno de desarrollo local utilizando Devcontainers y desplegar el **Bot Sincronización Programada Telegram -> NodeBB** como una **Firebase Cloud Function programada**. Se basa en los requisitos definidos en `requisitos_sincronizacion.md`.

El objetivo es proporcionar la forma más simple posible para trabajar localmente y desplegar la función en Firebase/GCP.

## 2. Prerrequisitos

Antes de empezar, asegúrate de tener:

*   **Cuenta Google y Proyecto GCP:** Un proyecto activo en Google Cloud Platform con facturación habilitada.
*   **Firebase CLI:** Instalada y actualizada ([Instrucciones](mdc:https:/firebase.google.com/docs/cli#setup_update_cli)).
*   **Node.js y npm/yarn:** (Si la función es Node.js) Versión compatible instalada.
*   **Docker y Extensión Dev Containers:** Para el desarrollo local ([Docker](mdc:https:/www.docker.com), [Extensión VS Code](mdc:https:/marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)).
*   **Código Fuente:** El código de la función en la carpeta `functions/`.
*   **Secretos Configurados:** Los secretos necesarios (Token Bot Telegram, Token API NodeBB) creados en **Google Secret Manager** en tu proyecto GCP.
*   **APIs Habilitadas en GCP:**
    *   Cloud Functions API
    *   Cloud Firestore API
    *   Secret Manager API
    *   Cloud Build API
    *   Cloud Scheduler API (Aunque Firebase CLI puede gestionarlo)
    *   IAM API
*   **Firestore Habilitado:** Base de datos Firestore creada en tu proyecto (Modo Nativo recomendado).

## 3. Desarrollo Local con Devcontainers

Para un entorno de desarrollo local consistente y simple, se recomienda usar Devcontainers.

1.  **Crear Configuración Devcontainer:**
    *   Crea una carpeta `.devcontainer` en la raíz de tu proyecto.
    *   Dentro, crea un archivo `devcontainer.json`.

2.  **Ejemplo `devcontainer.json` (Node.js):**

    ```json
    {
      "name": "Node.js Firebase Functions",
      // Usa una imagen oficial de Node.js
      "image": "mcr.microsoft.com/devcontainers/javascript-node:18", 

      // Características adicionales útiles
      "features": {
        "ghcr.io/devcontainers/features/firebase:1": {},
        "ghcr.io/devcontainers/features/docker-in-docker:2": {},
        "ghcr.io/devcontainers/features/google-cloud-cli:1": {}
      },

      // Ejecutar comandos después de crear el contenedor
      "postCreateCommand": "cd functions && npm install",

      // Montar la carpeta local en el contenedor
      "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
      "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",

      // Reenvía puertos si usas emuladores
      // "forwardPorts": [9099, 5001, 8080, 9000],

      // Configura VS Code dentro del contenedor
      "customizations": {
        "vscode": {
          "extensions": [
            "dbaeumer.vscode-eslint",
            "esbenp.prettier-vscode",
            "googlecloudtools.cloudcode" // Útil para GCP
          ]
        }
      },
      // Ejecutar como usuario no root
      "remoteUser": "node"
    }
    ```

3.  **Abrir en Contenedor:**
    *   Abre tu proyecto en VS Code.
    *   Usa la paleta de comandos (Ctrl+Shift+P o Cmd+Shift+P) y selecciona "Dev Containers: Reopen in Container".
    *   Esto construirá (la primera vez) y abrirá el proyecto dentro del contenedor con todas las herramientas (Node, Firebase CLI, gcloud CLI) listas.

4.  **Configuración Local de Entorno:**
    *   Puedes crear un archivo `.env` en la carpeta `functions/` basado en `configuracion_local.md` para pruebas locales.
    *   **Importante:** Para pruebas que requieran acceso a secretos *reales*, necesitarás autenticarte con `gcloud auth application-default login` dentro del contenedor para que las librerías de GCP puedan acceder a Secret Manager.
    *   **Emuladores:** Para probar la lógica sin tocar recursos reales, considera usar [Firebase Emulators](mdc:https:/firebase.google.com/docs/emulator-suite) (especialmente para Firestore). Configúralos en `firebase.json` y ejecútalos con `firebase emulators:start`.

## 4. Configuración del Entorno de Despliegue

La configuración se gestiona mediante **Variables de Entorno** para valores no sensibles y **Google Secret Manager** para secretos.

*   **Variables de Entorno (Obligatorias):**
    *   `TARGET_CHAT_ID`: ID del grupo de Telegram.
    *   `TARGET_HASHTAGS`: Lista de hashtags permitidos (ej: `"tag1,tag2"`).
    *   `NODEBB_URL`: URL base de NodeBB.
    *   `NODEBB_CATEGORY_ID`: ID de la categoría en NodeBB.
    *   `SCHEDULE_TIMEZONE`: Zona horaria para el schedule (ej: `"UTC"`, `"Europe/Madrid"`).
    *   `TELEGRAM_BOT_TOKEN_SECRET_NAME`: Nombre del secreto en Secret Manager para el token de Telegram.
    *   `NODEBB_API_USER_TOKEN_SECRET_NAME` o `NODEBB_API_MASTER_TOKEN_SECRET_NAME`: Nombre del secreto para el token de NodeBB.

*   **Variables de Entorno (Opcionales):**
    *   `LOG_LEVEL`: Nivel de log (ej: `"debug"`).
    *   `FIRESTORE_COLLECTION`: Nombre de la colección de tracking.
    *   `GCLOUD_PROJECT`: ID del proyecto (generalmente no necesario).
    *   `NODEBB_BOT_UID`: Si usas Master Token.

*   **Gestión de Secretos:**
    *   Los valores reales de `TELEGRAM_BOT_TOKEN` y el Token API de NodeBB **DEBEN** estar almacenados en Google Secret Manager bajo los nombres especificados en las variables `..._SECRET_NAME`.
    *   La cuenta de servicio de la Cloud Function necesita el rol `roles/secretmanager.secretAccessor`.

## 5. Despliegue Simplificado

El despliegue se realiza usando Firebase CLI. Como es una función programada, la configuración del schedule se hace en el código o en `firebase.json`.

1.  **Configurar el Schedule (Ejemplo en `index.js` - Node.js):**

    ```javascript
    const functions = require("firebase-functions");
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    // ... otros imports ...

    // Acceder a variables de entorno
    const scheduleTimezone = process.env.SCHEDULE_TIMEZONE || 'UTC';
    const telegramTokenSecretName = process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME;
    // ... obtener otras variables ...

    exports.syncTelegramToNodeBB = functions
        .region('europe-west1') // Especifica la región si es necesario
        .runWith({
            timeoutSeconds: 300, // Ajusta el timeout si es necesario
            memory: '256MB',     // Ajusta la memoria si es necesario
            secrets: [telegramTokenSecretName, process.env.NODEBB_API_USER_TOKEN_SECRET_NAME] // Declara los secretos a usar
        })
        .pubsub
        .schedule('every day 09:00') // Define la frecuencia
        .timeZone(scheduleTimezone) // Usa la zona horaria de la variable
        .onRun(async (context) => {
            console.log('Iniciando sincronización Telegram -> NodeBB...');
            // Aquí va la lógica principal de tu función
            // ... obtener secretos usando SecretManagerServiceClient ...
            // ... llamar a Telegram API ...
            // ... procesar mensajes ...
            // ... llamar a NodeBB API ...
            // ... escribir en Firestore ...
            console.log('Sincronización completada.');
            return null;
        });
    ```

2.  **Login y Selección de Proyecto:**
    *   Abre la terminal (dentro del Devcontainer si lo usas).
    *   `firebase login`
    *   `firebase use TU_PROJECT_ID`

3.  **Desplegar:**
    *   Ejecuta el comando de despliegue. Puedes pasar variables de entorno no secretas directamente:
        ```bash
        firebase deploy --only functions:syncTelegramToNodeBB \
        --set-env-vars TARGET_CHAT_ID="-1001234567890",TARGET_HASHTAGS="tag1,tag2",NODEBB_URL="https://foro.com",NODEBB_CATEGORY_ID="5",SCHEDULE_TIMEZONE="Europe/Madrid",TELEGRAM_BOT_TOKEN_SECRET_NAME="TELEGRAM_BOT_TOKEN",NODEBB_API_USER_TOKEN_SECRET_NAME="NODEBB_API_USER_TOKEN"
        ```
        *(Ajusta el comando a una sola línea o usa barras invertidas `\` para dividirlo)*
    *   Firebase CLI desplegará la función y configurará automáticamente el job en Cloud Scheduler basado en la definición `.schedule()`.

4.  **¡Importante!** A diferencia de las funciones HTTP, **no necesitas configurar ningún webhook** en Telegram. Cloud Scheduler invocará tu función directamente.

## 6. Verificación Post-Despliegue

1.  **Verificar Cloud Scheduler:** Ve a la consola de GCP -> Cloud Scheduler y confirma que el job para tu función (`firebase-schedule-syncTelegramToNodeBB-...`) ha sido creado y está habilitado con la programación correcta.
2.  **Verificar Cloud Function:** Comprueba que la función `syncTelegramToNodeBB` aparece en la consola de Firebase/GCP.
3.  **Prueba Manual (Opcional):** Puedes disparar una ejecución manualmente desde la consola de Cloud Scheduler seleccionando el job y haciendo clic en "Forzar ejecución".
4.  **Prueba Funcional:**
    *   Publica un mensaje en el grupo de Telegram que cumpla los criterios (hashtag + `Titulo: `).
    *   Espera a la próxima ejecución programada (o fuerza una ejecución).
    *   Verifica:
        *   Que se crea un nuevo tema en NodeBB.
        *   Que el `message_id` se registra en Firestore.
        *   Los logs de la función en Cloud Logging/Firebase Console.

## 7. Monitorización

*   **Cloud Logging:** Esencial para ver el output de la función y diagnosticar errores.
*   **Cloud Monitoring / Firebase Console (Salud):** Observa invocaciones, latencia, errores de ejecución.
*   **Cloud Scheduler:** Verifica el historial de ejecuciones del job. 