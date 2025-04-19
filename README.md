# Telegram to NodeBB Sync Bot

A scheduled Firebase Cloud Function to periodically synchronize specific tagged messages (containing a 'Titulo:' line) from a Telegram group to new topics in a NodeBB forum.

## Setup

1.  **Prerequisites:**
    *   Node.js (v18 recommended)
    *   Firebase CLI (`npm install -g firebase-tools`)
    *   Firebase Firestore enabled in your project
    *   Google Cloud SDK (`gcloud`)
    *   A Firebase Project
    *   A Telegram Bot Token
    *   A NodeBB instance with API access configured (User Token recommended)

2.  **Configuration (`functions/index.js`):**
    *   Update `GCP_PROJECT_ID` (or ensure it's set in the environment).
    *   Update `TELEGRAM_BOT_TOKEN_SECRET_NAME`, `NODEBB_API_USER_TOKEN_SECRET_NAME` (or `NODEBB_API_TOKEN_SECRET_NAME`) to match the names you'll use in Google Secret Manager.
    *   Update `NODEBB_URL` with your forum's base URL.
    *   Update `NODEBB_CATEGORY_ID` with the target category ID.
    *   Update `TARGET_HASHTAGS` with the hashtags you want to track.
    *   (Optional) Update `NODEBB_BOT_UID` if using a Master Token.

3.  **Store Secrets:**
    *   Enable the Secret Manager API in your Google Cloud project.
    *   Store your Telegram Bot Token and NodeBB API Token in Secret Manager using the names defined above (e.g., `TELEGRAM_BOT_TOKEN`, `NODEBB_API_USER_TOKEN`).
    *   Ensure the Cloud Functions service account has the 'Secret Manager Secret Accessor' IAM role.

4.  **Install Dependencies:**
    ```bash
    cd functions
    npm install
    cd ..
    ```

5.  **Deploy Function:**
    *   Log in to Firebase: `firebase login`
    *   Set your Firebase project: `firebase use YOUR_PROJECT_ID`
    *   Deploy: `firebase deploy --only functions`

6.  **Test:**
    *   Ensure the function is deployed and scheduled (or trigger it manually via the Google Cloud Console for testing).
    *   Send a message to the Telegram group that meets the criteria: contains a `TARGET_HASHTAG` (from the whitelist) and a line starting with `Titulo: Your Topic Title`.
    *   After the function's scheduled execution (or manual trigger):
        *   Verify that a new topic with "Your Topic Title" was created in the configured NodeBB category.
        *   Verify that the post content includes the message body and user information.
        *   Check Firestore (in the specified collection, e.g., 'processedTelegramMessages') to confirm the processed message's ID has been recorded.
        *   Check the Cloud Function logs in the Google Cloud Console or Firebase Console for errors or execution details.

## Requisitos Funcionales

1.  **RF01: Ejecución Programada:**
    *   Una función Cloud (Firebase Functions) se ejecutará diariamente a las 9:00 AM (zona horaria a definir, p. ej., UTC).

2.  **RF02: Identificación de Mensajes Candidatos:**
    *   La función obtendrá los mensajes recientes del grupo de Telegram especificado (p. ej., últimos 3 días).
    *   Filtrará los mensajes para seleccionar solo aquellos que:
        *   Contengan al menos uno de los hashtags definidos en la lista `TARGET_HASHTAGS` (whitelist). La **comparación** del hashtag será **insensible a mayúsculas/minúsculas**.
        *   Contengan una línea que empiece **exactamente** con la cadena "**Titulo: **" (sensible a mayúsculas y con espacio después de los dos puntos).
        *   **No** hayan sido procesados previamente (ver RF03).

3.  **RF03: Persistencia de Estado (Tracking):**
    *   Se utilizará **Firebase Firestore** para almacenar el ID único de cada mensaje de Telegram que ya ha sido **intentado** sincronizar.
    *   Antes de procesar un mensaje (RF04), se verificará en Firestore si su ID ya existe. Si existe, el mensaje se ignora.

4.  **RF04: Procesamiento de Mensajes Candidatos:**
    *   Por cada mensaje candidato (cumple RF02 y no está en Firestore):
        *   Extraer el **Título**: El texto que sigue a la **primera** ocurrencia de "Titulo: " en su propia línea. Si la línea "Titulo: " existe pero está vacía, el mensaje se considera inválido y se ignora.
        *   Extraer el **Contenido**: El resto del texto del mensaje, excluyendo la primera línea del título. Los hashtags (`TARGET_HASHTAGS`) **se dejarán tal cual** dentro del contenido.
        *   Extraer el nombre de usuario del remitente en Telegram.
        *   Extraer la fecha/hora del mensaje original.
        *   Formatear el **Contenido** extraído usando **Markdown**. *(Transformación futura opcional)*.

5.  **RF05: Creación de Contenido en NodeBB:**
    *   Para cada mensaje procesado (con Título y Contenido válidos):
        *   La función intentará crear un **nuevo tema (topic)** en NodeBB en la categoría `NODEBB_CATEGORY_ID`.
        *   El **Título** extraído (RF04) será el título del tema NodeBB.
        *   El **Contenido** extraído y formateado (RF04), junto con la mención al usuario de Telegram ("Publicado por @usuarioTelegram el DD/MM/AAAA HH:MM"), será el cuerpo del primer post del tema.
        *   Se utilizarán las credenciales configuradas (API Token/User Token).
        *   **Importante:** Los hashtags presentes en el mensaje de Telegram **no** se utilizarán para establecer las *tags* del tema en NodeBB en esta versión.

6.  **RF06: Actualización de Estado:**
    *   **Después** de que la función intente crear el tema en NodeBB para un mensaje específico (ya sea que la creación en NodeBB tenga éxito o falle), se añadirá el ID de ese mensaje de Telegram a Firestore (RF03) para marcarlo como "procesado" y evitar reintentos en futuras ejecuciones.

7.  **RF07: Manejo de Errores:**
    *   Errores al obtener mensajes de Telegram: Registrar el error y finalizar la ejecución de forma controlada.
    *   Errores al crear tema en NodeBB: Registrar el error detallado (incluyendo mensaje ID de Telegram y error de la API de NodeBB), pero **marcar el mensaje como procesado** en Firestore (RF06).
    *   Errores al interactuar con Firestore: Registrar el error.

8.  **RF08: Configuración:**
    *   Parámetros (tokens, URLs, IDs, hashtags, config Firebase) gestionados externamente (variables de entorno, Secret Manager).

9.  **RF09: Limitaciones Explícitas:**
    *   No se sincronizan ediciones ni eliminaciones.
    *   Solo se procesan mensajes con `TARGET_HASHTAG` (case-insensitive) y "Titulo: " (case-sensitive).
    *   Si "Titulo: " está presente pero vacío, se ignora.
    *   Posible pérdida de mensajes si la función falla por más de 3 días.
