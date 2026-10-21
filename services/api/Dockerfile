FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY services/api/package.json services/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --filter @openhome/api... --no-frozen-lockfile
COPY services/api services/api
COPY packages/contracts packages/contracts
RUN pnpm --filter @openhome/api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/services/api/node_modules ./services/api/node_modules
COPY --from=build /workspace/services/api/package.json ./services/api/package.json
COPY --from=build /workspace/services/api/dist ./services/api/dist
USER node
EXPOSE 3000
CMD ["node", "services/api/dist/index.js"]
