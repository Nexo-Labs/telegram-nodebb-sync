---
description: Guía para construir, publicar y ejecutar la imagen Docker del Bot Sincronización.
---
# Guía de Despliegue y Ejecución con Docker

**Versión:** 1.0
**Fecha:** 2025-04-19

## 1. Introducción

Este documento describe el proceso para construir y publicar una imagen Docker que contiene la lógica del **Bot Sincronización Programada Telegram -> NodeBB**, y cómo ejecutar esa imagen para realizar la sincronización. Este es un **método de despliegue alternativo** al uso directo de Firebase Cloud Functions.

## 2. Construcción y Publicación de la Imagen (Vía GitHub Actions)

Se ha configurado un workflow de GitHub Actions en `.github/workflows/docker-deploy.yml` que automatiza este proceso:

1.  **Trigger:** El workflow se dispara automáticamente cuando se crea y se empuja (push) una etiqueta Git que coincide con el patrón `v*` (ej: `v1.0.0`, `v1.2.3`).
2.  **Compilación TS:** El primer paso importante dentro del workflow es compilar el código TypeScript de `functions/src/` a JavaScript en `functions/lib/` ejecutando `npm run build` dentro del directorio `functions`. Esto es necesario porque el `Dockerfile` copia el contenido de `functions/lib`.
3.  **Construcción Docker:** Se utiliza `docker/build-push-action` para construir la imagen Docker usando el archivo `Dockerfile` ubicado en la raíz del proyecto.
4.  **Publicación en GHCR:** La imagen construida se etiqueta automáticamente (basado en la etiqueta Git) y se publica en el **GitHub Container Registry (GHCR)** del repositorio (`ghcr.io/<tu-usuario-o-org>/telegram-nodebb-sync`).
5.  **Firma (Signing):** La imagen publicada se firma utilizando `cosign` y Sigstore para verificar su procedencia.

**Requisitos para el Workflow:**
*   El código debe estar alojado en GitHub.
*   Las GitHub Actions deben estar habilitadas para el repositorio.
*   El paquete (`telegram-nodebb-sync`) debe estar habilitado como público o tener la configuración adecuada en GHCR si es privado.

## 3. Ejecución del Contenedor

Una vez que la imagen está publicada en GHCR, necesitas ejecutarla para que realice la tarea de sincronización. A diferencia de un servidor web, este contenedor ejecuta una tarea específica (`node lib/index.js`) y luego termina. La ejecución debe ser **programada externamente**.

**Método 1: Ejecución Manual (Para Pruebas)**

Puedes ejecutar la imagen manualmente desde cualquier máquina con Docker instalado:

1.  **Autenticarse en GHCR (si el paquete es privado):**
    ```bash
    echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
    ```
    (Reemplaza `USERNAME` y obtén un Personal Access Token `CR_PAT` con permiso `read:packages`).

2.  **Obtener la Imagen:**
    ```bash
    docker pull ghcr.io/<tu-usuario-o-org>/telegram-nodebb-sync:<tag>
    # Ejemplo: docker pull ghcr.io/fiser12/telegram-nodebb-sync:v1.0.0
    ```

3.  **Preparar Configuración/Secretos:** La aplicación dentro del contenedor necesita acceder a las mismas variables de entorno y secretos que la versión de Firebase Function. Debes proporcionárselos al contenedor. La forma más común es mediante variables de entorno (`-e` o `--env-file`).

    *   Crea un archivo `.env.docker` (¡**no lo commitees si tiene secretos reales!**) basado en `.env.template`:
        ```dotenv
        # .env.docker
        GCLOUD_PROJECT="tu-proyecto-gcp" # Necesario si lees secretos de GCP
        TARGET_CHAT_ID="-100xxxxxxxxxx"
        TARGET_HASHTAGS="tag1,tag2"
        NODEBB_URL="https://tu-foro.com"
        NODEBB_CATEGORY_ID="5"
        # ¡IMPORTANTE! Para Secret Manager, la app DENTRO de Docker necesita autenticarse.
        # O pasas los tokens DIRECTAMENTE como variables (menos seguro), o configuras ADC en el contenedor.
        # Opción A: Pasar tokens directamente (MENOS SEGURO):
        # TELEGRAM_BOT_TOKEN="12345:ABC..."
        # NODEBB_API_USER_TOKEN="xxxx-xxxx-xxxx-xxxx"
        # Opción B: Pasar NOMBRES de secretos y configurar autenticación ADC:
        TELEGRAM_BOT_TOKEN_SECRET_NAME="TELEGRAM_BOT_TOKEN"
        NODEBB_API_USER_TOKEN_SECRET_NAME="NODEBB_API_USER_TOKEN"
        # Para ADC, necesitas montar credenciales o usar metadata server si corre en GCP.
        # GOOGLE_APPLICATION_CREDENTIALS=/path/to/keyfile.json
        SCHEDULE_TIMEZONE="UTC"
        NODE_ENV="production" # Para que config.ts no use mocks
        ```

4.  **Ejecutar el Contenedor:**
    ```bash
    docker run --rm --env-file .env.docker \
      ghcr.io/<tu-usuario-o-org>/telegram-nodebb-sync:<tag>
    # Ejemplo: docker run --rm --env-file .env.docker ghcr.io/fiser12/telegram-nodebb-sync:v1.0.0
    ```
    *   `--rm`: Elimina el contenedor una vez que termina.
    *   `--env-file .env.docker`: Carga las variables del archivo.
    *   Si usas la Opción B para secretos (ADC), necesitarás configurar el acceso a GCP desde dentro del contenedor (ej: montando un volumen con la clave de servicio y estableciendo `GOOGLE_APPLICATION_CREDENTIALS`).

**Método 2: Ejecución Programada en la Nube (Ej: Google Cloud Run + Cloud Scheduler)**

Este es el enfoque más robusto para producción:

1.  **Desplegar en Cloud Run:**
    *   Crea un nuevo servicio en Google Cloud Run.
    *   Selecciona "Desplegar una revisión desde una imagen de contenedor existente".
    *   Ingresa la URL de tu imagen en GHCR (ej: `ghcr.io/<tu-usuario-o-org>/telegram-nodebb-sync:<tag>`).
    *   Configura la **Autenticación** para permitir invocaciones no autenticadas si Cloud Scheduler lo llamará vía HTTP, o configúralo como privado si usarás Cloud Run Jobs.
    *   **Variables de Entorno y Secretos:** En la configuración del servicio Cloud Run, ve a la sección "Variables y Secretos".
        *   Añade todas las variables de entorno necesarias (`TARGET_CHAT_ID`, `NODEBB_URL`, etc.).
        *   Para los **tokens**, utiliza la integración de Cloud Run con **Secret Manager**. Define una variable de entorno (ej: `TELEGRAM_BOT_TOKEN_SECRET_NAME`) y referénciala al secreto correspondiente en Secret Manager. Cloud Run montará el secreto de forma segura para que la aplicación (usando `config.ts` y `getSecrets`) pueda acceder a él. ¡Asegúrate de que la cuenta de servicio de Cloud Run tenga permiso para acceder a los secretos!
    *   Ajusta la **CPU y Memoria** según sea necesario.
    *   Despliega el servicio.

2.  **Configurar Cloud Scheduler:**
    *   Ve a Cloud Scheduler en la consola de GCP.
    *   Crea un nuevo **trabajo (job)**.
    *   **Frecuencia:** Define la programación usando sintaxis cron (ej: `0 9 * * *` para las 9:00 AM todos los días).
    *   **Zona Horaria:** Selecciona la zona horaria deseada.
    *   **Destino:** Selecciona `HTTP`.
    *   **URL:** Ingresa la URL de invocación de tu servicio Cloud Run.
    *   **Método HTTP:** `GET` (o `POST` si tu servicio espera eso para iniciar el trabajo).
    *   **(Si Cloud Run es privado):** Configura la autenticación OIDC para que Scheduler pueda llamar a Cloud Run.
    *   Crea el trabajo.

Cloud Scheduler invocará tu servicio Cloud Run según la programación, el contenedor se iniciará, ejecutará `node lib/index.js` (que contiene la lógica de sincronización), y luego terminará. Cloud Run gestionará el escalado (aunque aquí probablemente solo sea 1 instancia).

## 4. Actualizaciones

Para desplegar una nueva versión:

1.  Realiza los cambios en el código.
2.  Crea y empuja una nueva etiqueta Git (ej: `git tag v1.0.1 && git push origin v1.0.1`).
3.  GitHub Actions construirá y publicará automáticamente la nueva imagen en GHCR.
4.  Si usas Cloud Run, actualiza manualmente el servicio para usar la nueva etiqueta de imagen o configura despliegues continuos desde el registro de contenedores.

--- 