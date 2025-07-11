FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema para compilar algumas libs
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copiar package.json
COPY package.json ./
RUN npm install

# Copiar código
COPY index.js ./

# Criar diretórios necessários
RUN mkdir -p sessions qr-codes

EXPOSE 3001

CMD ["node", "index.js"]
