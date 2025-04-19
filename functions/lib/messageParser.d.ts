import { TelegramMessage, TelegramUser } from './telegramApi';
/**
 * Define la entrada para la función parseMessage.
 */
export interface ParseMessageInput {
    /** El objeto mensaje de Telegram a parsear. */
    message: TelegramMessage;
    /** Array de hashtags objetivo (en minúsculas y sin #). */
    targetHashtags: string[];
}
/**
 * Define la estructura de la información extraída de un mensaje válido.
 */
export interface ParsedMessageOutput {
    /** El título extraído de la línea "Titulo: ". */
    title: string;
    /** El contenido del mensaje (excluyendo la línea del título y hashtags si se decide). */
    content: string;
    /** Información del usuario que envió el mensaje. */
    user: TelegramUser | null;
    /** Fecha del mensaje original (timestamp Unix). */
    date: number;
    /** ID del mensaje original de Telegram. */
    messageId: number;
    /** ID del chat original de Telegram. */
    chatId: number;
}
/**
 * Parsea un mensaje de Telegram para verificar si es candidato para sincronización
 * y extrae la información relevante (título, contenido).
 *
 * Criterios para ser candidato:
 * 1. Contiene texto (`message.text`).
 * 2. Contiene al menos un hashtag de `targetHashtags` (case-insensitive).
 * 3. Contiene una línea que empieza exactamente con "Titulo: " (case-sensitive).
 * 4. El título extraído no está vacío.
 *
 * @param {ParseMessageInput} input Objeto con el mensaje y los hashtags objetivo.
 * @returns {ParsedMessageOutput | null} Un objeto con los datos parseados si el mensaje es válido,
 * o `null` si no cumple los criterios.
 */
export declare function parseMessage(input: ParseMessageInput): ParsedMessageOutput | null;
//# sourceMappingURL=messageParser.d.ts.map