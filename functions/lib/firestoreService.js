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
exports.checkIfProcessed = checkIfProcessed;
exports.markAsProcessed = markAsProcessed;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const config_1 = require("./config");
// --- Implementación ---
// Obtener instancia de Firestore (asumiendo que admin.initializeApp() ya se llamó en index.ts)
let db;
try {
    // No necesitamos llamar a initializeApp() aquí si ya se hizo en index.ts
    db = admin.firestore();
}
catch (error) {
    functions.logger.error("Error al obtener instancia de Firestore. ¿Se llamó a admin.initializeApp() antes?", error);
    throw new Error(`No se pudo obtener la instancia de Firestore: ${error instanceof Error ? error.message : String(error)}`);
}
// Obtener configuración una vez para el nombre de la colección
const config = (0, config_1.getConfig)();
const collectionName = config.firestoreCollection;
/**
 * Verifica si un messageId ya existe en la colección de tracking de Firestore.
 * @param {CheckIfProcessedInput} input Objeto con el messageId a verificar.
 * @returns {Promise<CheckIfProcessedOutput>} Promesa que resuelve al estado de procesamiento.
 */
async function checkIfProcessed(input) {
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
    }
    catch (error) {
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
async function markAsProcessed(input) {
    const { messageId, chatId, status, nodebbTopicId } = input;
    if (!messageId) {
        functions.logger.error("markAsProcessed llamado sin messageId válido", { input });
        // No podemos continuar sin messageId, podríamos lanzar un error o simplemente retornar.
        return; // Retornar void como indica la firma
    }
    const docId = String(messageId);
    const docRef = db.collection(collectionName).doc(docId);
    // Construir el objeto de datos a guardar, asegurando inmutabilidad
    const dataToSave = {
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
    }
    catch (error) {
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
//# sourceMappingURL=firestoreService.js.map