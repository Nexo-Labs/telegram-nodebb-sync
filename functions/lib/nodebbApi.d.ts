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
/**
 * Crea un nuevo tema en una instancia de NodeBB usando la API Write.
 *
 * @param {CreateNodebbTopicInput} input Objeto con los detalles necesarios para crear el tema.
 * @returns {Promise<CreateNodebbTopicOutput>} Promesa que resuelve con los IDs del tema y post creados.
 * @throws {Error} Si la llamada a la API de NodeBB falla.
 */
export declare function createNodebbTopic(input: CreateNodebbTopicInput): Promise<CreateNodebbTopicOutput>;
//# sourceMappingURL=nodebbApi.d.ts.map