/**
 * Define la entrada para la función checkIfProcessed.
 */
export interface CheckIfProcessedInput {
    /** El ID del mensaje de Telegram a verificar. */
    messageId: string | number;
}
/**
 * Define la salida de la función checkIfProcessed.
 */
export interface CheckIfProcessedOutput {
    /** True si el mensaje ya fue procesado, false en caso contrario. */
    isProcessed: boolean;
}
/**
 * Define los posibles estados del procesamiento de un mensaje.
 */
export type ProcessingStatus = 'success' | 'error_nodebb' | 'invalid';
/**
 * Define la entrada para la función markAsProcessed.
 */
export interface MarkAsProcessedInput {
    /** El ID del mensaje de Telegram a marcar. */
    messageId: string | number;
    /** El ID del chat de Telegram de origen. */
    chatId: string | number;
    /** El estado final del procesamiento. */
    status: ProcessingStatus;
    /** El ID del topic creado en NodeBB (opcional, solo si status es 'success'). */
    nodebbTopicId?: string | number | null;
}
/**
 * Verifica si un messageId ya existe en la colección de tracking de Firestore.
 * @param {CheckIfProcessedInput} input Objeto con el messageId a verificar.
 * @returns {Promise<CheckIfProcessedOutput>} Promesa que resuelve al estado de procesamiento.
 */
export declare function checkIfProcessed(input: CheckIfProcessedInput): Promise<CheckIfProcessedOutput>;
/**
 * Marca un mensaje como procesado en Firestore, escribiendo su estado.
 * @param {MarkAsProcessedInput} input Objeto con los detalles del mensaje y su estado de procesamiento.
 * @returns {Promise<void>} Promesa que se resuelve cuando la escritura finaliza (o rechaza en caso de error grave).
 */
export declare function markAsProcessed(input: MarkAsProcessedInput): Promise<void>;
//# sourceMappingURL=firestoreService.d.ts.map