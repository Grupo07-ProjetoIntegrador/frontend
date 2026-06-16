# Estágio de Build
FROM node:20-alpine AS build

WORKDIR /app

# Copia arquivos de dependências
COPY package.json package-lock.json ./
RUN npm ci

# Copia código-fonte restante
COPY . .

# Argumento para definir variáveis em tempo de compilação (se necessário)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Compila o projeto SPA
RUN npm run build

# Estágio de Execução
FROM nginx:alpine

# Copia a configuração personalizada do Nginx para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos compilados do estágio anterior para o diretório padrão do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
