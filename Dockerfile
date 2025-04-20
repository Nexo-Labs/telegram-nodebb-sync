# Dockerfile Multi-Etapa para construir y ejecutar la sincronización

# ---- Etapa 1: Builder ----
# Esta etapa instala TODAS las dependencias (incluyendo dev) y compila el TS
FROM node:18-alpine AS builder
WORKDIR /app

# Copiar archivos de definición de paquetes de la carpeta 'functions'
COPY functions/package.json functions/package-lock.json ./functions/

# Instalar TODAS las dependencias (incluyendo typescript para la compilación)
# Ejecutar dentro de la subcarpeta 'functions'
RUN cd functions && npm ci

# Copiar el código fuente de TypeScript y el archivo de configuración de TS
COPY functions/src ./functions/src
COPY functions/tsconfig.json ./functions/tsconfig.json

# Compilar TypeScript a JavaScript (genera la carpeta ./functions/lib)
RUN cd functions && npm run build

# ---- Etapa 2: Runner ----
# Esta etapa final toma solo lo necesario para ejecutar la aplicación
FROM node:18-alpine
WORKDIR /app

# Copiar solo los archivos de paquetes necesarios para instalar dependencias de producción
COPY functions/package.json functions/package-lock.json ./

# Instalar SOLO dependencias de producción
# Usamos --omit=dev (equivalente a --only=production en npm v7+)
RUN npm ci --omit=dev --ignore-scripts

# Copiar el código JavaScript compilado desde la etapa 'builder'
COPY --from=builder /app/functions/lib ./lib

# Crear un usuario no privilegiado
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Comando por defecto para mantener el contenedor corriendo para docker-compose run/exec
# (Mantenemos el de docker-compose.yaml, CMD aquí podría ser redundante pero no daña)
CMD ["tail", "-f", "/dev/null"] 