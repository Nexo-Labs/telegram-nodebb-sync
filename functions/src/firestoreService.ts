import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { getConfig } from "./config";

// --- Interfaces y Tipos ---

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

// --- Implementación ---

// Obtener instancia de Firestore (asumiendo que admin.initializeApp() ya se llamó en index.ts)
let db: admin.firestore.Firestore;
try {
    // No necesitamos llamar a initializeApp() aquí si ya se hizo en index.ts
    db = admin.firestore();
} catch (error: unknown) {
    functions.logger.error("Error al obtener instancia de Firestore. ¿Se llamó a admin.initializeApp() antes?", error);
    throw new Error(`No se pudo obtener la instancia de Firestore: ${error instanceof Error ? error.message : String(error)}`);
}

// Obtener configuración una vez para el nombre de la colección
const config = getConfig();
const collectionName = config.firestoreCollection;

/**
 * Verifica si un messageId ya existe en la colección de tracking de Firestore.
 * @param {CheckIfProcessedInput} input Objeto con el messageId a verificar.
 * @returns {Promise<CheckIfProcessedOutput>} Promesa que resuelve al estado de procesamiento.
 */
export async function checkIfProcessed(input: CheckIfProcessedInput): Promise<CheckIfProcessedOutput> {
    const { messageId } = input;

    if (!messageId) {
        functions.logger.warn("checkIfProcessed llamado sin messageId válido", { input });
        // Considerar si devolver { isProcessed: false } o lanzar un error es más apropiado.
        // Devolver false es consistente con el comportamiento anterior en caso de error.
        return { isProcessed: false };
    }

    const docId = String(messageId);
    const docRef = db.collection(collectionName).doc(docId);

    try {
        const docSnapshot = await docRef.get();
        functions.logger.debug(`Firestore check for ${docId}: exists=${docSnapshot.exists}`, { messageId: docId });
        return { isProcessed: docSnapshot.exists };
    } catch (error: unknown) {
        functions.logger.error(`Error al verificar documento ${docId} en Firestore`, { messageId: docId, error });
        // En caso de error de lectura, asumimos que no está procesado para no perder mensajes.
        return { isProcessed: false };
    }
}

/**
 * Marca un mensaje como procesado en Firestore, escribiendo su estado.
 * @param {MarkAsProcessedInput} input Objeto con los detalles del mensaje y su estado de procesamiento.
 * @returns {Promise<void>} Promesa que se resuelve cuando la escritura finaliza (o rechaza en caso de error grave).
 */
export async function markAsProcessed(input: MarkAsProcessedInput): Promise<void> {
    const { messageId, chatId, status, nodebbTopicId } = input;

    if (!messageId) {
        functions.logger.error("markAsProcessed llamado sin messageId válido", { input });
        // No podemos continuar sin messageId, podríamos lanzar un error o simplemente retornar.
        return; // Retornar void como indica la firma
    }

    const docId = String(messageId);
    const docRef = db.collection(collectionName).doc(docId);

    // Construir el objeto de datos a guardar, asegurando inmutabilidad
    const dataToSave: { [key: string]: any } = {
        processedAt: admin.firestore.FieldValue.serverTimestamp(), // Usar timestamp del servidor
        chatId: chatId,
        status: status,
    };

    if (nodebbTopicId !== null && nodebbTopicId !== undefined && status === 'success') {
        dataToSave.nodebbTopicId = nodebbTopicId;
    }

    try {
        functions.logger.info(`Marcando mensaje ${docId} como '${status}' en Firestore...`, { messageId: docId, status });
        // Usar set con merge:true es seguro por si hubiera una escritura concurrente (poco probable aquí)
        // pero dado que hacemos check before, un set simple también valdría.
        await docRef.set(dataToSave, { merge: true });
        functions.logger.debug(`Mensaje ${docId} marcado con éxito en Firestore.`);
    } catch (error: unknown) {
        functions.logger.error(`Error al marcar mensaje ${docId} en Firestore`, { messageId: docId, error });
        // No relanzamos el error para no detener el procesamiento de otros mensajes,
        // pero el log indica el fallo. La próxima ejecución podría reintentarlo
        // si el checkIfProcessed también falló o aún no se había ejecutado.
        // Si la escritura falla consistentemente, indica un problema mayor (permisos, etc.).
    }
}

module.exports = {
    checkIfProcessed,
    markAsProcessed,
}; 