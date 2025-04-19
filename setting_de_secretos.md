---
description: Guía para configurar los secretos necesarios en Google Secret Manager.
---
# Configuración de Secretos en Google Secret Manager

**Versión:** 1.0
**Fecha:** 2025-04-19

## 1. Introducción

Este documento describe cómo configurar los secretos (tokens de API) requeridos por el **Bot Sincronización Programada Telegram -> NodeBB** utilizando **Google Secret Manager**. Almacenar secretos de esta manera es crucial para la seguridad, evitando exponerlos directamente en el código o en variables de entorno.

La Cloud Function (`syncTelegramToNodeBB` en `index.ts`) está diseñada para leer los *nombres* de los secretos desde las variables de entorno y luego obtener los *valores* reales desde Secret Manager durante la ejecución.

## 2. Secretos Requeridos

Basado en la configuración (`config.ts` y `.env.template`), necesitas crear los siguientes secretos en Google Secret Manager dentro de tu proyecto GCP:

1.  **Token del Bot de Telegram:**
    *   **Nombre del Secreto:** El valor que pongas en la variable de entorno `TELEGRAM_BOT_TOKEN_SECRET_NAME` (por defecto es `TELEGRAM_BOT_TOKEN`).
    *   **Valor del Secreto:** El token completo proporcionado por BotFather en Telegram (ej: `1234567890:AAG***********************************`).

2.  **Token API de NodeBB:** Debes elegir **uno** de los siguientes, dependiendo del tipo de token que uses:
    *   **(Recomendado) Token de Usuario NodeBB:**
        *   **Nombre del Secreto:** El valor que pongas en la variable de entorno `NODEBB_API_USER_TOKEN_SECRET_NAME` (por defecto es `NODEBB_API_USER_TOKEN`).
        *   **Valor del Secreto:** El token API generado para un usuario específico en NodeBB (normalmente desde la configuración de perfil del usuario o la sección API en el panel de administración).
    *   **(Alternativa) Token Maestro NodeBB:**
        *   **Nombre del Secreto:** El valor que pongas en la variable de entorno `NODEBB_API_MASTER_TOKEN_SECRET_NAME` (ej: `NODEBB_API_MASTER_TOKEN`). *Nota: Por defecto no hay valor, si usas este, debes definir la variable de entorno.*.
        *   **Valor del Secreto:** El token maestro obtenido desde la configuración de la API en el panel de administración de NodeBB.
        *   **Importante:** Si usas un Master Token, también **debes** configurar la variable de entorno `NODEBB_BOT_UID` con el ID del usuario con el que se publicarán los temas.

**Resumen Nombres por Defecto:**
*   `TELEGRAM_BOT_TOKEN`
*   `NODEBB_API_USER_TOKEN`

## 3. Pasos para Crear los Secretos

1.  **Accede a Secret Manager:**
    *   Ve a la [Consola de Google Cloud](https://console.cloud.google.com/).
    *   Selecciona tu proyecto GCP.
    *   En el menú de navegación, ve a **Seguridad -> Secret Manager**.
    *   Asegúrate de que la API de Secret Manager esté habilitada.

2.  **Crea el Secreto para el Token de Telegram:**
    *   Haz clic en **"+ Crear Secreto"**.
    *   **Nombre:** Ingresa el nombre exacto que usarás en la variable de entorno `TELEGRAM_BOT_TOKEN_SECRET_NAME` (ej: `TELEGRAM_BOT_TOKEN`).
    *   **Valor del secreto:** Pega el token real de tu bot de Telegram.
    *   **Regiones de replicación:** Puedes dejar la opción automática o seleccionar regiones específicas.
    *   Haz clic en **"Crear secreto"**.

3.  **Crea el Secreto para el Token de NodeBB:**
    *   Haz clic en **"+ Crear Secreto"** nuevamente.
    *   **Nombre:** Ingresa el nombre exacto que usarás para la variable de entorno del token de NodeBB (ej: `NODEBB_API_USER_TOKEN` o `NODEBB_API_MASTER_TOKEN`).
    *   **Valor del secreto:** Pega el token API de NodeBB correspondiente (User o Master).
    *   Haz clic en **"Crear secreto"**.

## 4. Permisos IAM para la Cloud Function

Para que tu Cloud Function pueda leer estos secretos en tiempo de ejecución, su **cuenta de servicio** necesita permisos adecuados.

1.  **Identifica la Cuenta de Servicio:**
    *   Ve a [Cloud Functions](https://console.cloud.google.com/functions) en la consola de GCP.
    *   Selecciona tu función (`syncTelegramToNodeBB` una vez desplegada).
    *   Ve a la pestaña **"Detalles"** o **"General"**. Busca el campo **"Cuenta de servicio"**. Normalmente será algo como `<PROJECT_ID>@appspot.gserviceaccount.com` (cuenta por defecto) o una cuenta personalizada si la configuraste.

2.  **Otorga el Rol `Secret Manager Secret Accessor`:**
    *   Ve a **IAM y Administración -> IAM** en la consola de GCP.
    *   Haz clic en **"+ Otorgar Acceso"**.
    *   **Nuevos principales:** Pega la dirección de correo electrónico de la cuenta de servicio de tu función.
    *   **Asignar roles:** Busca y selecciona el rol **`Secret Manager Secret Accessor`**.
    *   Haz clic en **"Guardar"**.

Con estos pasos, los secretos estarán almacenados de forma segura y la Cloud Function tendrá permiso para acceder a ellos cuando se ejecute. 