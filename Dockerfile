# Dockerfile para ejecutar la lógica de sincronización Telegram -> NodeBB

# ---- Base Stage ----
# Usar una imagen base de Node.js v18 (Alpine para tamaño reducido)
FROM node:18-alpine AS base
WORKDIR /app

# ---- Dependencies Stage ----
# Copiar archivos de definición de paquetes
FROM base AS dependencies
COPY functions/package.json functions/package-lock.json ./
# Instalar SOLO dependencias de producción usando el lockfile
RUN npm ci --only=production

# ---- Build Stage (si tuvieras un paso de build de frontend, iría aquí) ----
# En nuestro caso, la compilación TS -> JS se hace fuera (o en predeploy)
# Así que este stage no es estrictamente necesario, pero lo mantenemos por estructura

# ---- Runner Stage ----
# Copiar dependencias y código compilado desde stages anteriores
FROM base AS runner
COPY --from=dependencies /app/node_modules ./node_modules
# Copiar el código compilado desde la carpeta 'lib' generada por tsc
COPY functions/lib ./lib

# Crear un usuario no privilegiado para ejecutar la aplicación
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Comando por defecto al iniciar el contenedor.
# Ejecuta el script principal de la lógica de sincronización.
# Este script debería manejar su propio ciclo de vida (ejecutar y terminar).
CMD ["node", "lib/index.js"] 