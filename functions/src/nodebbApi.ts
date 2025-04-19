import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions';

// --- Interfaces y Tipos ---

/**
 * Define la entrada para la función createNodebbTopic.
 */
export interface CreateNodebbTopicInput {
    /** La URL base de la instancia de NodeBB (ej: https://foro.com). */
    nodebbUrl: string;
    /** El Token de API de NodeBB (User o Master Token). */
    apiToken: string;
    /** El ID numérico de la categoría donde crear el tema. */
    categoryId: string | number;
    /** El título para el nuevo tema. */
    title: string;
    /** El contenido (cuerpo) del primer post del tema (en formato Markdown). */
    content: string;
    /** Opcional: El ID del usuario con el que publicar (solo si se usa Master Token). */
    // uid?: string | number | null;
}

/**
 * Define la estructura esperada de la respuesta de la API de NodeBB al crear un tema.
 * Esto es una suposición y puede necesitar ajustarse según la versión de la API.
 */
interface NodeBBTopicResponsePayload {
    topicData: {
        tid: number; // ID del tema creado
        // ... otras propiedades
    };
    postData: {
        pid: number; // ID del post creado
        // ... otras propiedades
    };
    // ... otras propiedades
}

interface NodeBBApiResponse {
    payload: NodeBBTopicResponsePayload;
    // status: { code: string; message: string; };
    // ... otras propiedades
}

/**
 * Define la salida de la función createNodebbTopic en caso de éxito.
 */
export interface CreateNodebbTopicOutput {
    /** El ID del tema (tid) creado en NodeBB. */
    topicId: number;
    /** El ID del post (pid) inicial creado en NodeBB. */
    postId: number;
}

// --- Implementación ---

/**
 * Crea un nuevo tema en una instancia de NodeBB usando la API Write.
 *
 * @param {CreateNodebbTopicInput} input Objeto con los detalles necesarios para crear el tema.
 * @returns {Promise<CreateNodebbTopicOutput>} Promesa que resuelve con los IDs del tema y post creados.
 * @throws {Error} Si la llamada a la API de NodeBB falla.
 */
export async function createNodebbTopic(input: CreateNodebbTopicInput): Promise<CreateNodebbTopicOutput> {
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
        const response = await axios.post<NodeBBApiResponse>(apiUrl, payload, {
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
        } else {
            // La API respondió pero no con el formato esperado
            functions.logger.error("Respuesta inesperada de NodeBB API", {
                status: response.status,
                data: response.data,
                requestPayload: payload // Loggear lo que enviamos para depurar
            });
            throw new Error(`Respuesta inesperada de NodeBB API (status ${response.status})`);
        }

    } catch (error: unknown) {
        const axiosError = error as AxiosError;
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
        } else if (axiosError.request) {
            // Error de red o timeout
            functions.logger.error("Error de red o timeout llamando a NodeBB API", {
                message: axiosError.message,
                url: apiUrl
            });
            throw new Error(`Error de red o timeout llamando a NodeBB: ${axiosError.message}`);
        } else {
            // Otro tipo de error (ej, al construir la petición)
            functions.logger.error("Error inesperado en createNodebbTopic", { error, url: apiUrl });
            throw new Error(`Error inesperado al intentar crear tema en NodeBB: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
} 