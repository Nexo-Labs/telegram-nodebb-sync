"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.getSecrets = getSecrets;
const secret_manager_1 = require("@google-cloud/secret-manager");
const functions = __importStar(require("firebase-functions")); // Import functions logger
// --- Implementación ---
// Instancia del cliente de Secret Manager (se inicializa una vez)
let secretManagerClient = null;
/**
 * Obtiene la configuración principal de las variables de entorno.
 * Proporciona valores predeterminados y tipado fuerte.
 * @returns {AppConfig} Objeto con la configuración de la aplicación.
 */
function getConfig() {
    // Helper para asegurar que las variables obligatorias existan
    const getEnvVar = (name, defaultValue) => {
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
        telegramBotTokenSecretName: getEnvVar('TELEGRAM_BOT_TOKEN_SECRET_NAME', 'TELEGRAM_BOT_TOKEN'),
        nodebbApiUserTokenSecretName: getEnvVar('NODEBB_API_USER_TOKEN_SECRET_NAME', 'NODEBB_API_USER_TOKEN'),
        nodebbApiMasterTokenSecretName: process.env.NODEBB_API_MASTER_TOKEN_SECRET_NAME || null,
        logLevel: ['debug', 'info', 'warn', 'error'].includes(logLevel) ? logLevel : 'info',
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
async function getSecrets(input) {
    const { secretResourceNames } = input;
    const config = getConfig();
    const secrets = {};
    // Filtrar nombres nulos o indefinidos
    const validSecretNames = secretResourceNames.filter((name) => !!name);
    // --- Mocking Logic ---
    if (!config.isProduction || !config.gcpProjectId) {
        functions.logger.warn('Funcionando en modo local/desarrollo o sin GCP_PROJECT_ID. Usando MOCK secrets.');
        validSecretNames.forEach(fullName => {
            const parts = fullName.split('/');
            // Asegurarse de que el formato es correcto (projects/id/secrets/NAME/versions/latest)
            const shortName = parts.length >= 4 ? parts[parts.length - 2] : fullName;
            if (!shortName) {
                functions.logger.error(`Nombre de secreto inválido o mal formateado: ${fullName}`);
                return;
            }
            secrets[shortName] = `MOCK_${shortName}_VALUE`;
        });
        return secrets;
    }
    // --- Real Secret Manager Logic ---
    if (!secretManagerClient) {
        secretManagerClient = new secret_manager_1.SecretManagerServiceClient();
    }
    const promises = validSecretNames.map(async (fullName) => {
        const parts = fullName.split('/');
        const shortName = parts.length >= 4 ? parts[parts.length - 2] : null;
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
        }
        catch (error) { // Tipar error como unknown
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
    if (validSecretNames.length !== Object.keys(secrets).length && config.isProduction) {
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
//# sourceMappingURL=config.js.map