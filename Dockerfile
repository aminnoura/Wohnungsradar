FROM node:20-slim
ARG APP
ENV APP=${APP}
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@wr/${APP}..." 
CMD pnpm --filter "@wr/${APP}" start
