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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentMessages = getRecentMessages;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
// --- Implementación ---
const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';
/**
 * Obtiene los mensajes recientes de un chat específico de Telegram.
 * Utiliza getUpdates y filtra localmente por fecha y chat ID.
 * NOTA: getUpdates puede no ser eficiente para recuperar históricos muy largos
 * y depende del tiempo que Telegram retenga las actualizaciones no confirmadas.
 * Para este caso ('últimos 3 días'), intentamos obtener un lote grande y filtrar.
 *
 * @param {GetRecentMessagesInput} input Objeto con botToken, chatId y daysAgo.
 * @returns {Promise<GetRecentMessagesOutput>} Promesa que resuelve a un objeto con la lista de mensajes.
 */
async function getRecentMessages(input) {
    const { botToken, chatId, daysAgo = 3 } = input;
    const targetChatId = Number(chatId); // Asegurar que sea número para comparación
    if (!botToken || !targetChatId) {
        functions.logger.error("getRecentMessages: botToken o chatId inválidos.", { chatId });
        throw new Error("Token de bot y Chat ID son requeridos.");
    }
    // Calcular el timestamp Unix para el límite de tiempo
    const now = Math.floor(Date.now() / 1000);
    const cutoffTimestamp = now - (daysAgo * 24 * 60 * 60);
    const apiUrl = `${TELEGRAM_API_BASE_URL}${botToken}/getUpdates`;
    // Pedir un límite alto de mensajes para aumentar probabilidad de cubrir los 3 días
    // Telegram puede limitar esto internamente (max 100 por defecto)
    const params = {
        limit: 100, // Máximo permitido por la API en una sola llamada
        // offset: -100, // No usar offset si queremos filtrar por fecha post-fetch
        allowed_updates: ["message"], // Solo nos interesan mensajes nuevos
    };
    try {
        functions.logger.info(`Llamando a Telegram getUpdates para chat ${targetChatId}...`, { url: apiUrl });
        // Timeout corto para evitar que la función se quede colgada indefinidamente
        const response = await axios_1.default.get(apiUrl, { params, timeout: 15000 }); // 15 segundos timeout
        if (!response.data.ok || !Array.isArray(response.data.result)) {
            functions.logger.error("Respuesta inválida de Telegram API", { status: response.status, data: response.data });
            throw new Error(`Respuesta inválida de Telegram API: ${JSON.stringify(response.data)}`); // Stringify data
        }
        const updates = response.data.result;
        functions.logger.info(`Recibidos ${updates.length} updates de Telegram.`);
        // Filtrar los updates para obtener solo los mensajes relevantes
        const relevantMessages = updates
            .map(update => update.message) // Extraer el mensaje de cada update
            .filter((message) => // Type guard para asegurar que message no es undefined
         !!message && // Existe el mensaje
            message.chat.id === targetChatId && // Pertenece al chat correcto
            message.date >= cutoffTimestamp && // Está dentro del rango de tiempo
            !!message.text // Tiene contenido de texto (necesario para buscar 'Titulo:')
        );
        functions.logger.info(`Encontrados ${relevantMessages.length} mensajes relevantes en chat ${targetChatId} desde hace ${daysAgo} días.`);
        // Podríamos querer confirmar los updates procesados usando el 'offset' en futuras llamadas
        // pero para la lógica simple de "últimos 3 días", este filtrado es suficiente por ahora.
        return { messages: relevantMessages };
    }
    catch (error) {
        const axiosError = error; // Type assertion
        if (axiosError.response) {
            // Error en la respuesta de Telegram (4xx, 5xx)
            functions.logger.error("Error en la respuesta de Telegram API", {
                status: axiosError.response.status,
                data: axiosError.response.data,
                chatId: targetChatId,
            });
            throw new Error(`Error de Telegram API: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
        }
        else if (axiosError.request) {
            // Error de red o timeout
            functions.logger.error("Error de red o timeout llamando a Telegram API", {
                message: axiosError.message,
                chatId: targetChatId,
            });
            throw new Error(`Error de red o timeout llamando a Telegram: ${axiosError.message}`);
        }
        else {
            // Otro tipo de error
            functions.logger.error("Error inesperado en getRecentMessages", { error, chatId: targetChatId });
            throw new Error(`Error inesperado: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Si queremos que la función no falle completamente en caso de error de API,
        // podríamos descomentar la siguiente línea y comentar los throw anteriores.
        // return { messages: [] };
    }
}
//# sourceMappingURL=telegramApi.js.map