import * as functions from 'firebase-functions';
import { TelegramMessage, TelegramUser } from './telegramApi'; // Importar el tipo de mensaje

// --- Interfaces y Tipos ---

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
    user: TelegramUser | null; // Puede ser null si message.from no está definido
    /** Fecha del mensaje original (timestamp Unix). */
    date: number;
    /** ID del mensaje original de Telegram. */
    messageId: number;
    /** ID del chat original de Telegram. */
    chatId: number;
}

// --- Implementación ---

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
export function parseMessage(input: ParseMessageInput): ParsedMessageOutput | null {
    const { message, targetHashtags } = input;

    // 1. Verificar que hay texto en el mensaje
    if (!message.text) {
        functions.logger.debug(`Mensaje ${message.message_id} descartado: Sin texto.`);
        return null;
    }

    const messageText = message.text;
    const lowerCaseText = messageText.toLowerCase();

    // 2. Verificar si contiene un hashtag objetivo (case-insensitive)
    const containsTargetHashtag = targetHashtags.some(tag => lowerCaseText.includes(`#${tag}`));
    if (!containsTargetHashtag) {
        functions.logger.debug(`Mensaje ${message.message_id} descartado: No contiene hashtag objetivo (${targetHashtags.join(',')}).`);
        return null;
    }

    // 3. Buscar la línea "Titulo: " (case-sensitive) y extraer título y contenido
    const lines = messageText.split('\n');
    let title: string | null = null;
    let titleLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        if (currentLine !== undefined && currentLine.startsWith('Titulo: ')) {
            title = currentLine.substring('Titulo: '.length).trim();
            titleLineIndex = i;
            break; // Usar solo la primera ocurrencia
        }
    }

    // 4. Verificar si se encontró un título y no está vacío
    if (title === null || title === '') {
        functions.logger.debug(`Mensaje ${message.message_id} descartado: No se encontró línea "Titulo: " válida.`);
        return null;
    }

    // 5. Extraer el contenido (excluyendo la línea del título)
    const contentLines = lines.filter((_, index) => index !== titleLineIndex);
    const content = contentLines.join('\n').trim(); // Unir el resto de líneas

    // 6. Extraer otra información relevante
    const user = message.from ?? null; // Usar nullish coalescing por si from es undefined
    const date = message.date;
    const messageId = message.message_id;
    const chatId = message.chat.id;

    functions.logger.info(`Mensaje ${messageId} parseado con éxito. Título: "${title}"`);

    // Crear y devolver el objeto de salida inmutable
    return {
        title,
        content,
        user,
        date,
        messageId,
        chatId,
    };
}

// Opcional: Función auxiliar para formatear fecha (se podría añadir aquí o en otro módulo)
// export function formatTimestamp(timestamp: number): string { ... } 