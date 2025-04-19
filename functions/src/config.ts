import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as functions from 'firebase-functions'; // Import functions logger

// --- Interfaces y Tipos ---

/**
 * Define la estructura del objeto de configuración de la aplicación.
 */
export interface AppConfig {
    /** ID del proyecto en Google Cloud. */
    gcpProjectId: string | null;
    /** ID del chat/grupo de Telegram objetivo. */
    targetChatId: string | null;
    /** Array de hashtags objetivo (en minúsculas). */
    targetHashtags: string[];
    /** URL base de la instancia de NodeBB. */
    nodebbUrl: string | null;
    /** ID numérico de la categoría NodeBB destino. */
    nodebbCategoryId: string | null;
    /** ID de usuario opcional en NodeBB (si se usa Master Token). */
    nodebbBotUid: string | null;
    /** Token del bot de Telegram (si se proporciona directamente). */
    telegramBotToken: string | null;
    /** Token de API de usuario de NodeBB (si se proporciona directamente). */
    nodebbApiUserToken: string | null;
    /** Token de API maestro de NodeBB (opcional, si se proporciona directamente). */
    nodebbApiMasterToken: string | null;
    /** Nombre del secreto en Secret Manager para el token del bot de Telegram (alternativa). */
    telegramBotTokenSecretName: string | null;
    /** Nombre del secreto en Secret Manager para el token de API de usuario de NodeBB (alternativa). */
    nodebbApiUserTokenSecretName: string | null;
    /** Nombre del secreto en Secret Manager para el token de API maestro de NodeBB (opcional, alternativa). */
    nodebbApiMasterTokenSecretName: string | null;
    /** Nivel de log deseado ('debug', 'info', 'warn', 'error'). */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Nombre de la colección Firestore para tracking. */
    firestoreCollection: string;
    /** Zona horaria para la ejecución programada (formato TZ Database Name). */
    scheduleTimezone: string;
    /** Indica si el entorno es de producción. */
    isProduction: boolean;
}

/**
 * Objeto que contiene los secretos recuperados.
 * Las claves son los nombres cortos de los secretos (ej: 'TELEGRAM_BOT_TOKEN').
 */
export interface Secrets {
    [key: string]: string; // Permite claves dinámicas
}

/**
 * Define la entrada para la función getSecrets.
 */
export interface GetSecretsInput {
    /** Array con los nombres completos de los secretos a obtener (formato: projects/PROJECT_ID/secrets/NAME/versions/latest). */
    secretResourceNames: (string | null | undefined)[]; // Permite nulos/undefined en el array
}

// --- Implementación ---

// Instancia del cliente de Secret Manager (se inicializa una vez)
let secretManagerClient: SecretManagerServiceClient | null = null;

/**
 * Obtiene la configuración principal de las variables de entorno.
 * Proporciona valores predeterminados y tipado fuerte.
 * @returns {AppConfig} Objeto con la configuración de la aplicación.
 */
export function getConfig(): AppConfig {
    // Helper para asegurar que las variables obligatorias existan
    const getEnvVar = (name: string, defaultValue?: string): string => {
        const value = process.env[name];
        if (value === undefined && defaultValue === undefined) {
            // En producción, lanzar error si falta una variable obligatoria sin default
            if (process.env.NODE_ENV === 'production') {
                throw new Error(`Variable de entorno obligatoria no definida: ${name}`);
            }
            // En desarrollo, advertir y devolver un valor por defecto seguro (ej: string vacío)
            functions.logger.warn(`Variable de entorno no definida: ${name}. Usando default temporal.`);
            return ''; // O un valor por defecto más adecuado
        }
        return value ?? defaultValue ?? '';
    };

    const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

    return {
        gcpProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || null,
        targetChatId: getEnvVar('TARGET_CHAT_ID'), // Obligatorio
        targetHashtags: (getEnvVar('TARGET_HASHTAGS', ""))
            .split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag.length > 0),
        nodebbUrl: getEnvVar('NODEBB_URL'), // Obligatorio
        nodebbCategoryId: getEnvVar('NODEBB_CATEGORY_ID'), // Obligatorio
        nodebbBotUid: process.env.NODEBB_BOT_UID || null,

        // Prioritize direct env vars for secrets, fall back to secret names for GCP
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
        nodebbApiUserToken: process.env.NODEBB_API_USER_TOKEN || null, // Renamed from NODEBB_API_KEY for consistency
        nodebbApiMasterToken: process.env.NODEBB_API_MASTER_TOKEN || null,

        telegramBotTokenSecretName: process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME || null,
        nodebbApiUserTokenSecretName: process.env.NODEBB_API_USER_TOKEN_SECRET_NAME || null,
        nodebbApiMasterTokenSecretName: process.env.NODEBB_API_MASTER_TOKEN_SECRET_NAME || null,

        logLevel: ['debug', 'info', 'warn', 'error'].includes(logLevel) ? logLevel as AppConfig['logLevel'] : 'info',
        firestoreCollection: getEnvVar('FIRESTORE_COLLECTION', 'processedTelegramMessages'),
        scheduleTimezone: getEnvVar('SCHEDULE_TIMEZONE', 'UTC'),
        isProduction: process.env.NODE_ENV === 'production',
    };
}

/**
 * Obtiene los valores de los secretos desde Google Secret Manager o devuelve mocks.
 * @param {GetSecretsInput} input Objeto que contiene el array `secretResourceNames` con los nombres completos de los secretos.
 * @returns {Promise<Secrets>} Promesa que resuelve a un objeto con los nombres cortos como clave y sus valores secretos.
 */
export async function getSecrets(input: GetSecretsInput): Promise<Secrets> {
    const { secretResourceNames } = input;
    const config = getConfig(); // config now potentially holds direct tokens
    const secrets: Secrets = {};

    // --- Incorporate Direct Tokens if available ---
    // If direct tokens were provided via env vars, use them immediately
    if (config.telegramBotToken) {
        secrets['TELEGRAM_BOT_TOKEN'] = config.telegramBotToken; // Use the actual token value
    }
    if (config.nodebbApiUserToken) {
        secrets['NODEBB_API_USER_TOKEN'] = config.nodebbApiUserToken;
    }
    if (config.nodebbApiMasterToken) {
        secrets['NODEBB_API_MASTER_TOKEN'] = config.nodebbApiMasterToken;
    }

    // --- Filter secret names for GCP fetching ---
    // Only attempt to fetch secrets from GCP if the corresponding direct token wasn't already provided
    const secretsToFetchNames = secretResourceNames.filter((name): name is string => {
        if (!name) return false;
        const parts = name.split('/');
        const shortName = parts.length >= 4 ? parts[parts.length - 2] : null;
        if (!shortName) return false;

        // Don't fetch if the direct token was already found
        if (shortName === 'TELEGRAM_BOT_TOKEN' && config.telegramBotToken) return false;
        if (shortName === 'NODEBB_API_USER_TOKEN' && config.nodebbApiUserToken) return false;
        if (shortName === 'NODEBB_API_MASTER_TOKEN' && config.nodebbApiMasterToken) return false;

        return true; // Fetch this secret name from GCP
    });

    // --- Mocking Logic (Only for secrets NOT provided directly) ---
    if ((!config.isProduction || !config.gcpProjectId) && secretsToFetchNames.length > 0) {
        functions.logger.warn('Modo local/desarrollo o sin GCP_PROJECT_ID. Usando MOCK secrets para los no proporcionados directamente.');
        secretsToFetchNames.forEach(fullName => {
            const parts = fullName.split('/');
            const shortName = parts.length >= 4 ? parts[parts.length - 2] : fullName;
            if (!shortName) {
                functions.logger.error(`Nombre de secreto inválido: ${fullName}`);
                return;
            }
            // Only add mock if not already present from direct env var
            if (!secrets[shortName]) {
                secrets[shortName] = `MOCK_${shortName}_VALUE`;
            }
        });
        // Return combined direct secrets and mocks
        return secrets;
    }

    // --- Real Secret Manager Logic (Only for secrets NOT provided directly) ---
    if (secretsToFetchNames.length === 0) {
         functions.logger.info('Todos los secretos necesarios fueron proporcionados via ENV. No se necesita llamar a Secret Manager.');
        return secrets; // Return secrets obtained directly or previously fetched
    }

    if (!secretManagerClient) {
        secretManagerClient = new SecretManagerServiceClient();
    }

    const promises = secretsToFetchNames.map(async (fullName) => {
        const parts = fullName.split('/');
        const shortName = parts.length >= 4 ? parts[parts.length-2] : null;

        if (!shortName) {
            functions.logger.error(`Nombre de secreto inválido o mal formateado: ${fullName}`);
            // Podríamos lanzar un error o simplemente omitir este secreto
            return null; // Omitir este secreto inválido
        }

        try {
            functions.logger.debug(`Accediendo a secreto: ${fullName}`);
            if (!secretManagerClient) {
                functions.logger.error('secretManagerClient no está inicializado');
                return null;
            }
            const [version] = await secretManagerClient.accessSecretVersion({ name: fullName });
            // Comprobar si el payload y data existen antes de acceder
            const payload = version.payload?.data?.toString();
            if (payload === undefined || payload === null) {
                 functions.logger.error(`Payload del secreto ${fullName} está vacío o no es válido.`);
                 throw new Error(`Payload vacío para secreto: ${shortName}`);
            }
            functions.logger.info(`Secreto ${shortName} accedido con éxito.`);
            return { [shortName]: payload };
        } catch (error: unknown) { // Tipar error como unknown
            functions.logger.error(`Error accediendo al secreto ${fullName}:`, error);
            // Lanzar error para detener la ejecución si un secreto esencial falla
            throw new Error(`Fallo al acceder al secreto esencial: ${shortName}. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    const results = await Promise.all(promises);

    results.forEach(result => {
        if (result) {
            Object.assign(secrets, result);
        }
    });

    // Verificar si obtuvimos todos los secretos esperados (opcional pero recomendado)
    if (secretsToFetchNames.length !== Object.keys(secrets).length && config.isProduction) {
         functions.logger.error('No se pudieron obtener todos los secretos requeridos.');
         // Podríamos lanzar un error aquí dependiendo de la criticidad
         // throw new Error('Fallo al obtener uno o más secretos.');
    }

    return secrets;
}

module.exports = {
    getConfig,
    getSecrets,
}; 