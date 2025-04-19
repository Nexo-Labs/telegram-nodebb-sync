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
exports.syncTelegramToNodeBB = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
const telegramApi_1 = require("./telegramApi");
const nodebbApi_1 = require("./nodebbApi");
const firestoreService_1 = require("./firestoreService");
const messageParser_1 = require("./messageParser");
// --- Inicialización --- 
// Inicializar Firebase Admin SDK (solo una vez)
try {
    admin.initializeApp();
}
catch (e) {
    // Evitar reinicialización en entornos de emulador o pruebas
    if (e.code !== 'app/duplicate-app') {
        console.error('Firebase admin initialization error', e);
    }
}
// --- Helper Functions ---
/**
 * Formatea un timestamp Unix a una cadena DD/MM/AAAA HH:MM.
 * @param {number} timestamp Timestamp Unix (segundos).
 * @returns {string} Fecha formateada.
 */
function formatTimestamp(timestamp) {
    // Multiplicar por 1000 para convertir a milisegundos
    const date = new Date(timestamp * 1000);
    // Usar Intl.DateTimeFormat para un formato localizado y robusto
    // Puedes ajustar 'es-ES' y las opciones según necesidad
    const formatter = new Intl.DateTimeFormat('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false, // formato 24h
    });
    return formatter.format(date);
}
/**
 * Construye el contenido final del post para NodeBB.
 * @param {ParsedMessageOutput} parsedData Datos parseados del mensaje.
 * @returns {string} Contenido formateado en Markdown.
 */
function buildNodebbContent(parsedData) {
    const formattedDate = formatTimestamp(parsedData.date);
    const authorInfo = parsedData.user
        ? `_Publicado originalmente por @${parsedData.user.username || parsedData.user.first_name} el ${formattedDate}_`
        : `_Publicado originalmente el ${formattedDate}_`;
    // Combina el contenido extraído con la información del autor
    // Asegura un salto de línea entre el contenido y la info del autor
    return `${parsedData.content}\n\n${authorInfo}`;
}
// --- Cloud Function Principal ---
// Definir la función programada
exports.syncTelegramToNodeBB = functions.region('europe-west1') // Ajustar región si es necesario
    .runWith({
    timeoutSeconds: 540, // Máximo permitido para funciones programadas
    memory: '256MB', // Ajustar según necesidad
    // Declarar los secretos que la función necesita acceder
    // Usa los NOMBRES CORTOS de los secretos definidos en config.ts
    // Asegúrate de que coincidan con los process.env usados en getConfig()
    secrets: ["TELEGRAM_BOT_TOKEN", "NODEBB_API_USER_TOKEN"]
    // Si usas Master Token, cambia NODEBB_API_USER_TOKEN por NODEBB_API_MASTER_TOKEN si ese es el nombre
})
    .pubsub
    .schedule('every day 09:00') // Configuración del schedule (ej: cada día a las 9 AM)
    .timeZone((0, config_1.getConfig)().scheduleTimezone) // Usar la zona horaria de la config
    .onRun(async (context) => {
    functions.logger.info(`[${context.eventId}] Iniciando ejecución de syncTelegramToNodeBB...`);
    const config = (0, config_1.getConfig)(); // Obtener configuración
    let secrets;
    try {
        // --- 1. Obtener Configuración y Secretos ---
        functions.logger.info(`[${context.eventId}] Configuración cargada:`, { config: { ...config, targetHashtags: config.targetHashtags.join(',') } }); // Log config, ocultando/resumiendo secretos si es necesario
        // Construir nombres completos de los secretos requeridos
        const requiredSecretResourceNames = [
            `projects/${config.gcpProjectId}/secrets/${config.telegramBotTokenSecretName}/versions/latest`,
            `projects/${config.gcpProjectId}/secrets/${config.nodebbApiUserTokenSecretName}/versions/latest`
            // Añadir config.nodebbApiMasterTokenSecretName aquí si se usa
        ].filter(name => !!name && name.includes('null') === false); // Filtrar nulos/undefined y nombres que contengan 'null'
        secrets = await (0, config_1.getSecrets)({ secretResourceNames: requiredSecretResourceNames });
        // Verificar que tenemos los tokens necesarios
        const telegramToken = secrets[config.telegramBotTokenSecretName];
        const nodebbToken = secrets[config.nodebbApiUserTokenSecretName]; // O el master token
        if (!telegramToken || !nodebbToken) {
            throw new Error("No se pudieron obtener los tokens necesarios de Secret Manager.");
        }
        functions.logger.info(`[${context.eventId}] Secretos obtenidos con éxito.`);
        // --- 2. Obtener Mensajes Recientes de Telegram ---
        if (!config.targetChatId) {
            throw new Error("TARGET_CHAT_ID no está configurado.");
        }
        const { messages } = await (0, telegramApi_1.getRecentMessages)({
            botToken: telegramToken,
            chatId: config.targetChatId,
            daysAgo: 3, // Buscar en los últimos 3 días
        });
        functions.logger.info(`[${context.eventId}] Obtenidos ${messages.length} mensajes de Telegram.`);
        // --- 3. Procesar cada Mensaje ---
        let processedCount = 0;
        let skippedCount = 0;
        let nodebbSuccessCount = 0;
        let nodebbErrorCount = 0;
        let invalidCount = 0;
        for (const message of messages) {
            const messageIdStr = String(message.message_id);
            let status = 'invalid'; // Estado por defecto
            let nodebbTopicId = null;
            try {
                // a. Verificar si ya fue procesado
                const { isProcessed } = await (0, firestoreService_1.checkIfProcessed)({ messageId: message.message_id });
                if (isProcessed) {
                    functions.logger.debug(`[${context.eventId}] Mensaje ${messageIdStr} ya procesado. Saltando.`);
                    skippedCount++;
                    continue; // Pasar al siguiente mensaje
                }
                // b. Parsear el mensaje
                const parsedData = (0, messageParser_1.parseMessage)({ message, targetHashtags: config.targetHashtags });
                if (parsedData) {
                    // c. Si es válido, intentar crear tema en NodeBB
                    functions.logger.info(`[${context.eventId}] Mensaje ${messageIdStr} válido. Intentando publicar en NodeBB...`);
                    const nodebbContent = buildNodebbContent(parsedData);
                    try {
                        if (!config.nodebbUrl || !config.nodebbCategoryId) {
                            throw new Error("NODEBB_URL o NODEBB_CATEGORY_ID no configurados.");
                        }
                        const { topicId } = await (0, nodebbApi_1.createNodebbTopic)({
                            nodebbUrl: config.nodebbUrl,
                            apiToken: nodebbToken,
                            categoryId: config.nodebbCategoryId,
                            title: parsedData.title,
                            content: nodebbContent,
                        });
                        status = 'success';
                        nodebbTopicId = topicId;
                        nodebbSuccessCount++;
                        functions.logger.info(`[${context.eventId}] Mensaje ${messageIdStr} publicado con éxito en NodeBB (tid: ${topicId}).`);
                    }
                    catch (nodebbError) {
                        functions.logger.error(`[${context.eventId}] Error al publicar mensaje ${messageIdStr} en NodeBB.`, { error: nodebbError });
                        status = 'error_nodebb';
                        nodebbErrorCount++;
                        // No relanzar el error aquí para continuar con otros mensajes
                    }
                }
                else {
                    // d. Si no es válido según las reglas (sin título, etc.)
                    functions.logger.info(`[${context.eventId}] Mensaje ${messageIdStr} no cumple los criterios de parseo.`);
                    status = 'invalid';
                    invalidCount++;
                }
                // e. Marcar como procesado en Firestore (independientemente del resultado de NodeBB si se intentó)
                await (0, firestoreService_1.markAsProcessed)({
                    messageId: message.message_id,
                    chatId: message.chat.id,
                    status: status,
                    nodebbTopicId: nodebbTopicId,
                });
                processedCount++;
            }
            catch (error) {
                // Capturar errores inesperados durante el procesamiento de UN mensaje
                functions.logger.error(`[${context.eventId}] Error inesperado procesando mensaje ${messageIdStr}. Continuando con el siguiente.`, { error });
                // Opcionalmente, marcarlo como error en Firestore si tenemos ID
                try {
                    await (0, firestoreService_1.markAsProcessed)({ messageId: message.message_id, chatId: message.chat.id, status: 'error_nodebb' }); // Usar un status genérico de error?
                }
                catch (fsError) {
                    functions.logger.error(`[${context.eventId}] Fallo adicional al intentar marcar mensaje ${messageIdStr} con error.`, { fsError });
                }
                // Continuar con el siguiente mensaje
            }
        } // Fin del bucle for
        // --- 4. Log Final --- 
        functions.logger.info(`[${context.eventId}] Sincronización completada. Resumen:`, {
            totalMessagesChecked: messages.length,
            processedAttempted: processedCount,
            skippedAlreadyProcessed: skippedCount,
            nodebbSuccess: nodebbSuccessCount,
            nodebbError: nodebbErrorCount,
            invalidFormat: invalidCount,
        });
        return null; // Indicar éxito de la ejecución programada
    }
    catch (error) {
        // Capturar errores graves que detienen toda la ejecución (ej: obtener secretos, obtener mensajes)
        functions.logger.error(`[${context.eventId}] Error fatal durante la ejecución de syncTelegramToNodeBB.`, { error });
        // La función fallará y podría reintentarse según la configuración de Cloud Scheduler
        throw error; // Relanzar para que Firebase marque la ejecución como fallida
    }
});
//# sourceMappingURL=index.js.map