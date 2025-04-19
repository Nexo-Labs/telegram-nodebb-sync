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
exports.parseMessage = parseMessage;
const functions = __importStar(require("firebase-functions"));
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
function parseMessage(input) {
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
    let title = null;
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
//# sourceMappingURL=messageParser.js.map