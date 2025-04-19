---
description: Guía para configurar las variables de entorno necesarias para el despliegue de la Cloud Function.
---
# Configuración de Variables de Entorno para Despliegue

**Versión:** 1.0
**Fecha:** 2025-04-19

## 1. Introducción

Este documento describe las variables de entorno que la Cloud Function `syncTelegramToNodeBB` necesita para funcionar correctamente cuando se despliega en Firebase/GCP. Estas variables proporcionan la configuración específica del entorno (IDs, URLs, nombres de secretos) que la función lee usando el módulo `config.ts` (`process.env`).

Es fundamental configurar estas variables correctamente durante el proceso de despliegue.

## 2. Variables de Entorno Requeridas

Estas variables **deben** ser establecidas para que la función opere:

1.  **`TARGET_CHAT_ID`**: 
    *   **Descripción:** El ID numérico del grupo o canal de Telegram que la función debe monitorizar.
    *   **Ejemplo:** `"-1001234567890"` (Los IDs de grupo suelen ser negativos).
    *   **Usado en:** `config.ts` para saber de dónde leer mensajes.

2.  **`TARGET_HASHTAGS`**: 
    *   **Descripción:** Una cadena de texto con los hashtags objetivo, separados por comas, sin el símbolo `#` y en minúsculas (aunque el parseador los convierte a minúsculas).
    *   **Ejemplo:** `"importante,anuncio,release"`
    *   **Usado en:** `config.ts` y `messageParser.ts` para filtrar mensajes.

3.  **`NODEBB_URL`**: 
    *   **Descripción:** La URL base completa de tu instancia de NodeBB.
    *   **Ejemplo:** `"https://mi-foro.ejemplo.com"`
    *   **Usado en:** `config.ts` y `nodebbApi.ts` para saber a qué API llamar.

4.  **`NODEBB_CATEGORY_ID`**: 
    *   **Descripción:** El ID numérico de la categoría específica en NodeBB donde se crearán los nuevos temas.
    *   **Ejemplo:** `"5"`
    *   **Usado en:** `config.ts` y `nodebbApi.ts` para crear temas en el lugar correcto.

5.  **`TELEGRAM_BOT_TOKEN_SECRET_NAME`**: 
    *   **Descripción:** El **nombre** (no el valor) del secreto almacenado en Google Secret Manager que contiene el token de tu bot de Telegram.
    *   **Valor por defecto en código:** `TELEGRAM_BOT_TOKEN` (si no se establece la variable, el código usará este nombre).
    *   **Ejemplo:** `"TELEGRAM_BOT_TOKEN"` o `"mi-bot-telegram-token-prod"` (si usas un nombre personalizado en Secret Manager).
    *   **Usado en:** `config.ts` para construir el nombre completo del recurso secreto y obtener el token.

6.  **`NODEBB_API_USER_TOKEN_SECRET_NAME` *O* `NODEBB_API_MASTER_TOKEN_SECRET_NAME`**: 
    *   **Descripción:** El **nombre** del secreto en Google Secret Manager que contiene el token API de NodeBB. Debes proporcionar el nombre correspondiente al tipo de token que has almacenado (Usuario o Maestro).
    *   **Valor por defecto (User Token):** `NODEBB_API_USER_TOKEN`.
    *   **Ejemplo (User):** `"NODEBB_API_USER_TOKEN"`
    *   **Ejemplo (Master):** `"NODEBB_API_MASTER_TOKEN"`
    *   **Usado en:** `config.ts` para obtener el token API de NodeBB.

## 3. Variables de Entorno Opcionales

Estas variables tienen valores por defecto en `config.ts` pero pueden ser sobrescritas si necesitas personalizarlas:

1.  **`GCLOUD_PROJECT` / `GCP_PROJECT`**: 
    *   **Descripción:** El ID de tu proyecto GCP. Normalmente, la Cloud Function puede detectarlo automáticamente del entorno de ejecución, pero establecerlo explícitamente puede ser útil en algunos casos o para pruebas locales.
    *   **Usado en:** `config.ts` para construir el nombre completo del recurso secreto.

2.  **`NODEBB_BOT_UID`**: 
    *   **Descripción:** El ID numérico del usuario de NodeBB con el que se deben publicar los temas **si estás usando un Master Token**. Si usas un User Token, esta variable se ignora.
    *   **Ejemplo:** `"1"`
    *   **Usado en:** `config.ts` (actualmente solo leído, la lógica para usarlo con Master Token en `nodebbApi.ts` está comentada, habría que añadirla si se usa Master Token).

3.  **`SCHEDULE_TIMEZONE`**: 
    *   **Descripción:** La zona horaria para interpretar el schedule 'every day 09:00'. Debe ser un nombre de la base de datos TZ (IANA).
    *   **Valor por defecto:** `"UTC"`.
    *   **Ejemplo:** `"Europe/Madrid"`, `"America/New_York"`
    *   **Usado en:** `index.ts` en la definición de la función programada.

4.  **`LOG_LEVEL`**: 
    *   **Descripción:** Controla el nivel de detalle de los logs ('debug', 'info', 'warn', 'error').
    *   **Valor por defecto:** `"info"`.
    *   **Ejemplo:** `"debug"`
    *   **Usado en:** `config.ts` (actualmente solo leído, podrías usarlo en tu lógica de logging si implementas niveles).

5.  **`FIRESTORE_COLLECTION`**: 
    *   **Descripción:** El nombre de la colección en Firestore usada para rastrear mensajes procesados.
    *   **Valor por defecto:** `"processedTelegramMessages"`.
    *   **Ejemplo:** `"telegram_sync_tracker_prod"`
    *   **Usado en:** `config.ts` y `firestoreService.ts`.

6.  **`NODE_ENV`**: 
    *   **Descripción:** Indica el entorno de ejecución. `config.ts` lo usa para decidir si usar mocks para los secretos (si no es `"production"`). Firebase Functions lo establece automáticamente a `production` en el entorno desplegado.
    *   **Valor Desplegado:** `"production"` (automático).
    *   **Ejemplo Local:** `"development"`

## 4. Métodos para Establecer Variables de Entorno

Hay dos métodos principales para establecer estas variables al desplegar con Firebase CLI:

**Método 1: Flag `--set-env-vars` (Recomendado para Despliegues Simples/CI)**

   Puedes pasar las variables directamente en el comando `firebase deploy`. Es útil para scripts de CI/CD.

   ```bash
   firebase deploy --only functions:syncTelegramToNodeBB \
   --set-env-vars TARGET_CHAT_ID="-1001234567890",TARGET_HASHTAGS="tag1,tag2",NODEBB_URL="https://foro.com",NODEBB_CATEGORY_ID="5",SCHEDULE_TIMEZONE="Europe/Madrid",TELEGRAM_BOT_TOKEN_SECRET_NAME="TELEGRAM_BOT_TOKEN",NODEBB_API_USER_TOKEN_SECRET_NAME="NODEBB_API_USER_TOKEN"
   ```
   *   Separa cada par `VARIABLE=valor` con una coma.
   *   Envuelve los valores que contienen espacios o caracteres especiales entre comillas (`"`).
   *   **Ventaja:** Simple, autocontenido en el comando.
   *   **Desventaja:** El comando puede volverse muy largo.

**Método 2: Archivos `.env` Específicos del Entorno (Recomendado para Múltiples Entornos)**

   Puedes crear archivos `.env` específicos para diferentes entornos (ej: `.env.production`, `.env.staging`) y decirle a Firebase CLI cuál usar.

   1.  **Crea el archivo:** Por ejemplo, crea `functions/.env.production` con el contenido:
       ```
       TARGET_CHAT_ID="-1001234567890"
       TARGET_HASHTAGS="tag1,tag2"
       NODEBB_URL="https://prod-foro.com"
       NODEBB_CATEGORY_ID="10"
       TELEGRAM_BOT_TOKEN_SECRET_NAME="TELEGRAM_BOT_TOKEN_PROD"
       NODEBB_API_USER_TOKEN_SECRET_NAME="NODEBB_API_USER_TOKEN_PROD"
       SCHEDULE_TIMEZONE="UTC"
       # etc...
       ```
       **¡No incluyas este archivo en Git si contiene información sensible!** Aunque aquí solo son nombres de secretos y configuración, es buena práctica.

   2.  **Despliega usando el archivo:**
       ```bash
       # Desde la raíz del proyecto
       firebase deploy --only functions:syncTelegramToNodeBB --project <tu-project-id> --config firebase.json --env-file functions/.env.production
       # O si estás en el directorio functions/
       # firebase deploy --only functions:syncTelegramToNodeBB --project <tu-project-id> --config ../firebase.json --env-file .env.production 
       ```
       *Nota: Puede que `--config` y `--env-file` no sean necesarios si Firebase los detecta automáticamente, pero especificarlos es más seguro.* 
       *(Corrección: `--env-file` no es un flag estándar de `firebase deploy`. La forma canónica es usar `--set-env-vars` o gestionar variables directamente en la consola de GCP/Firebase Functions)*

**Corrección Importante:** Firebase CLI **no tiene un flag `--env-file`** directo para `deploy`. La gestión de variables de entorno para diferentes entornos se maneja típicamente mediante:
    *   El flag `--set-env-vars` (como en el Método 1).
    *   **Configurando las variables de entorno directamente en la Consola de Google Cloud** para la función desplegada. Esto permite gestionar diferentes conjuntos de variables para diferentes proyectos o funciones.
    *   Usando librerías como `dotenv` *durante el desarrollo local* (`require('dotenv').config({ path: '.env.local' })`) pero **no** confiando en ella para el entorno desplegado, donde las variables deben ser establecidas por la plataforma.

**Recomendación Final:**

*   Para **secretos**, usa siempre **Google Secret Manager**.
*   Para **configuración no sensible**, usa el flag **`--set-env-vars`** en tu comando `firebase deploy`, especialmente en flujos de CI/CD. Si tienes muchos entornos o variables, considera gestionarlas directamente en la **configuración de la función en la Consola de GCP** después del despliegue inicial. 