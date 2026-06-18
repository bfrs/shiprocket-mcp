import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() =>
  server.listen({
    onUnhandledRequest: (request, print) => {
      if (new URL(request.url).hostname === "localhost") {
        return;
      }
      print.error();
    },
  })
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
