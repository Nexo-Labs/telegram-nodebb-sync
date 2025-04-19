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
exports.createNodebbTopic = createNodebbTopic;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
// --- Implementación ---
/**
 * Crea un nuevo tema en una instancia de NodeBB usando la API Write.
 *
 * @param {CreateNodebbTopicInput} input Objeto con los detalles necesarios para crear el tema.
 * @returns {Promise<CreateNodebbTopicOutput>} Promesa que resuelve con los IDs del tema y post creados.
 * @throws {Error} Si la llamada a la API de NodeBB falla.
 */
async function createNodebbTopic(input) {
    const { nodebbUrl, apiToken, categoryId, title, content } = input;
    // Validar entradas básicas
    if (!nodebbUrl || !apiToken || !categoryId || !title) {
        functions.logger.error("createNodebbTopic: Faltan parámetros obligatorios.", { input });
        throw new Error("URL de NodeBB, Token API, ID de Categoría y Título son requeridos.");
    }
    // Construir la URL del endpoint (asumiendo v3, ajustar si es necesario)
    const apiUrl = `${nodebbUrl.replace(/\/$/, '')}/api/v3/topics`; // Quita la barra final si existe
    // Construir el payload
    const payload = {
        cid: Number(categoryId), // Asegurar que sea número
        title: title,
        content: content,
        // _uid: input.uid ? Number(input.uid) : undefined // Añadir _uid solo si se proporciona
    };
    // Construir cabeceras
    const headers = {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
    };
    try {
        functions.logger.info(`Llamando a NodeBB API para crear tema...`, { url: apiUrl, categoryId, title });
        const response = await axios_1.default.post(apiUrl, payload, {
            headers,
            timeout: 20000, // Timeout de 20 segundos
        });
        // Validar la respuesta de NodeBB
        // Asumiendo que una respuesta exitosa tiene status 200 y un payload con topicData.tid y postData.pid
        if (response.status === 200 && response.data?.payload?.topicData?.tid && response.data?.payload?.postData?.pid) {
            const topicId = response.data.payload.topicData.tid;
            const postId = response.data.payload.postData.pid;
            functions.logger.info(`Tema creado con éxito en NodeBB. tid: ${topicId}, pid: ${postId}`, { topicId, postId });
            return { topicId, postId };
        }
        else {
            // La API respondió pero no con el formato esperado
            functions.logger.error("Respuesta inesperada de NodeBB API", {
                status: response.status,
                data: response.data,
                requestPayload: payload // Loggear lo que enviamos para depurar
            });
            throw new Error(`Respuesta inesperada de NodeBB API (status ${response.status})`);
        }
    }
    catch (error) {
        const axiosError = error;
        if (axiosError.response) {
            // Error en la respuesta de NodeBB (4xx, 5xx)
            functions.logger.error("Error en la respuesta de NodeBB API", {
                status: axiosError.response.status,
                data: axiosError.response.data,
                url: apiUrl,
                requestPayload: payload
            });
            // Propagar un error más específico
            throw new Error(`Error de NodeBB API: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
        }
        else if (axiosError.request) {
            // Error de red o timeout
            functions.logger.error("Error de red o timeout llamando a NodeBB API", {
                message: axiosError.message,
                url: apiUrl
            });
            throw new Error(`Error de red o timeout llamando a NodeBB: ${axiosError.message}`);
        }
        else {
            // Otro tipo de error (ej, al construir la petición)
            functions.logger.error("Error inesperado en createNodebbTopic", { error, url: apiUrl });
            throw new Error(`Error inesperado al intentar crear tema en NodeBB: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=nodebbApi.js.map