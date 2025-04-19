/**
 * Representa la estructura básica de un usuario de Telegram.
 */
export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
}
/**
 * Representa la estructura básica de un chat de Telegram.
 */
export interface TelegramChat {
    id: number;
    type: string;
    title?: string;
}
/**
 * Representa la estructura básica de un mensaje de Telegram relevante para nosotros.
 * Adaptado de la API de Bot de Telegram: https://core.telegram.org/bots/api#message
 */
export interface TelegramMessage {
    message_id: number;
    from?: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
}
/**
 * Representa una actualización recibida de Telegram.
 * Adaptado de: https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
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
export declare function getRecentMessages(input: GetRecentMessagesInput): Promise<GetRecentMessagesOutput>;
//# sourceMappingURL=telegramApi.d.ts.map