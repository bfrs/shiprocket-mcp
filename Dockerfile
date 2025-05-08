FROM node:22.15.0-alpine3.20 AS build
WORKDIR /usr/src/app
RUN chown -R node:node /usr/src/app
USER node
COPY --chown=node:node package*.json tsconfig.json ./
RUN npm i
COPY --chown=node:node . .
RUN npm run build

FROM node:22.15.0-alpine3.20 AS app
EXPOSE 3000
WORKDIR /usr/src/app
RUN apk update && apk add curl && chown -R node:node /usr/src/app
USER node
COPY --chown=node:node --from=build /usr/src/app/package*.json /usr/src/app/tsconfig.json ./
RUN npm i --omit=dev --omit=optional
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/.env ./
CMD npm start