import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions';

// --- Interfaces y Tipos ---

/**
 * Representa la estructura básica de un usuario de Telegram.
 */
export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string; // Opcional
    username?: string;  // Opcional
}

/**
 * Representa la estructura básica de un chat de Telegram.
 */
export interface TelegramChat {
    id: number;
    type: string; // "private", "group", "supergroup", "channel"
    title?: string; // Opcional, para grupos/canales
}

/**
 * Representa la estructura básica de un mensaje de Telegram relevante para nosotros.
 * Adaptado de la API de Bot de Telegram: https://core.telegram.org/bots/api#message
 */
export interface TelegramMessage {
    message_id: number;
    from?: TelegramUser; // Opcional (ej: mensajes de canal)
    chat: TelegramChat;
    date: number; // Timestamp Unix
    text?: string; // Opcional (puede no tener texto)
    // Podríamos añadir 'entities' si lo necesitáramos aquí
}

/**
 * Representa una actualización recibida de Telegram.
 * Adaptado de: https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    // Podríamos añadir otros tipos de update si fueran necesarios (edited_message, etc.)
}


/**
 * Define la entrada para la función getRecentMessages.
 */
export interface GetRecentMessagesInput {
    /** El token del Bot de Telegram. */
    botToken: string;
    /** El ID del chat/grupo objetivo. */
    chatId: string | number;
    /** Número de días hacia atrás para buscar mensajes. */
    daysAgo?: number;
}

/**
 * Define la salida de la función getRecentMessages.
 */
export interface GetRecentMessagesOutput {
    /** Array con los mensajes de Telegram que cumplen los criterios. */
    messages: TelegramMessage[];
}

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
export async function getRecentMessages(input: GetRecentMessagesInput): Promise<GetRecentMessagesOutput> {
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
        const response = await axios.get<{ ok: boolean; result: TelegramUpdate[] }>(apiUrl, { params, timeout: 15000 }); // 15 segundos timeout

        if (!response.data.ok || !Array.isArray(response.data.result)) {
            functions.logger.error("Respuesta inválida de Telegram API", { status: response.status, data: response.data });
            throw new Error(`Respuesta inválida de Telegram API: ${JSON.stringify(response.data)}`); // Stringify data
        }

        const updates: TelegramUpdate[] = response.data.result;
        functions.logger.info(`Recibidos ${updates.length} updates de Telegram.`);

        // Filtrar los updates para obtener solo los mensajes relevantes
        const relevantMessages: TelegramMessage[] = updates
            .map(update => update.message) // Extraer el mensaje de cada update
            .filter((message): message is TelegramMessage => // Type guard para asegurar que message no es undefined
                !!message && // Existe el mensaje
                message.chat.id === targetChatId && // Pertenece al chat correcto
                message.date >= cutoffTimestamp && // Está dentro del rango de tiempo
                !!message.text // Tiene contenido de texto (necesario para buscar 'Titulo:')
            );

        functions.logger.info(`Encontrados ${relevantMessages.length} mensajes relevantes en chat ${targetChatId} desde hace ${daysAgo} días.`);

        // Podríamos querer confirmar los updates procesados usando el 'offset' en futuras llamadas
        // pero para la lógica simple de "últimos 3 días", este filtrado es suficiente por ahora.

        return { messages: relevantMessages };

    } catch (error: unknown) {
        const axiosError = error as AxiosError; // Type assertion
        if (axiosError.response) {
            // Error en la respuesta de Telegram (4xx, 5xx)
            functions.logger.error("Error en la respuesta de Telegram API", {
                status: axiosError.response.status,
                data: axiosError.response.data,
                chatId: targetChatId,
            });
            throw new Error(`Error de Telegram API: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
            // Error de red o timeout
            functions.logger.error("Error de red o timeout llamando a Telegram API", {
                message: axiosError.message,
                chatId: targetChatId,
            });
            throw new Error(`Error de red o timeout llamando a Telegram: ${axiosError.message}`);
        } else {
            // Otro tipo de error
            functions.logger.error("Error inesperado en getRecentMessages", { error, chatId: targetChatId });
            throw new Error(`Error inesperado: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Si queremos que la función no falle completamente en caso de error de API,
        // podríamos descomentar la siguiente línea y comentar los throw anteriores.
        // return { messages: [] };
    }
} 