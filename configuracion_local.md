---
description: Ejemplo de archivo .env para configuración local del Bot Sincronización Programada Telegram -> NodeBB
---
# Ejemplo de archivo .env para el Bot Sincronización Programada Telegram -> NodeBB
# Usar principalmente para configuraciones locales o no sensibles.
# Los secretos críticos DEBEN estar en Google Secret Manager y referenciados por sus nombres.

# --- Configuración de Firebase/GCP (Opcional - a menudo gestionado por Firebase CLI) ---
# GCLOUD_PROJECT="tu-gcp-project-id" # ID de tu proyecto en Google Cloud (generalmente detectado)

# --- Configuración General de la Función ---
# ID del Chat/Grupo de Telegram a monitorizar
TARGET_CHAT_ID="-1001234567890"

# Hashtags a buscar (separados por coma, sin #)
# Ejemplo: "#importante,#anuncio" se escribe como "importante,anuncio"
TARGET_HASHTAGS="importante,anuncio,release"

# Zona horaria para la ejecución programada (formato TZ Database Name, ej: Europe/Madrid)
# Ver: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
SCHEDULE_TIMEZONE="UTC"

# --- Configuración de NodeBB ---
# URL base de la instancia de NodeBB
NODEBB_URL="https://tu-foro.nodebb.com"

# ID de la categoría donde se crearán los temas
NODEBB_CATEGORY_ID="5"

# (Opcional) ID del usuario de NodeBB con el que se publicará si usas Master Token
# NODEBB_BOT_UID="1"

# --- Nombres de los Secretos en Google Secret Manager ---
# Estos NO son los secretos en sí, sino los NOMBRES para buscarlos en Secret Manager.
# Deben coincidir con los nombres que uses al crear los secretos en GCP.

# Nombre del secreto que contiene el Token del Bot de Telegram
TELEGRAM_BOT_TOKEN_SECRET_NAME="TELEGRAM_BOT_TOKEN"

# Nombre del secreto que contiene el Token API de NodeBB (User Token o Master Token)
# Usar uno de los dos según el tipo de token que vayas a emplear:
NODEBB_API_USER_TOKEN_SECRET_NAME="NODEBB_API_USER_TOKEN"
# NODEBB_API_MASTER_TOKEN_SECRET_NAME="NODEBB_API_MASTER_TOKEN"

# --- Configuración para Desarrollo/Depuración (Opcional) ---
# Nivel de log deseado (ej. 'debug', 'info', 'warn', 'error')
# LOG_LEVEL="debug"

# --- Colección Firestore (Opcional - si quieres que sea configurable) ---
# Nombre de la colección en Firestore para guardar los IDs procesados
# FIRESTORE_COLLECTION="processedTelegramMessages"

# --- NOTA IMPORTANTE ---
# Asegúrate de que los secretos reales (Telegram Bot Token, NodeBB API Token)
# están creados y accesibles en Google Secret Manager bajo los nombres especificados arriba.
# La cuenta de servicio de la Cloud Function necesita el rol 'Secret Manager Secret Accessor'. 