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
    /** Nombre del secreto en Secret Manager para el token del bot de Telegram. */
    telegramBotTokenSecretName: string;
    /** Nombre del secreto en Secret Manager para el token de API de usuario de NodeBB. */
    nodebbApiUserTokenSecretName: string;
    /** Nombre del secreto en Secret Manager para el token de API maestro de NodeBB (opcional). */
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
    [key: string]: string;
}
/**
 * Define la entrada para la función getSecrets.
 */
export interface GetSecretsInput {
    /** Array con los nombres completos de los secretos a obtener (formato: projects/PROJECT_ID/secrets/NAME/versions/latest). */
    secretResourceNames: (string | null | undefined)[];
}
/**
 * Obtiene la configuración principal de las variables de entorno.
 * Proporciona valores predeterminados y tipado fuerte.
 * @returns {AppConfig} Objeto con la configuración de la aplicación.
 */
export declare function getConfig(): AppConfig;
/**
 * Obtiene los valores de los secretos desde Google Secret Manager o devuelve mocks.
 * @param {GetSecretsInput} input Objeto que contiene el array `secretResourceNames` con los nombres completos de los secretos.
 * @returns {Promise<Secrets>} Promesa que resuelve a un objeto con los nombres cortos como clave y sus valores secretos.
 */
export declare function getSecrets(input: GetSecretsInput): Promise<Secrets>;
//# sourceMappingURL=config.d.ts.map