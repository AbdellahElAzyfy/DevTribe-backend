const request = require("supertest");
const { buildApp } = require("../src/app");

describe("GET /api/v1/health", () => {
  it("returns service health information", async () => {
    const app = buildApp({ clientOrigin: "http://localhost:5173" });

    const response = await request(app).get("/api/v1/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("devtribe-backend");
    expect(response.body.timestamp).toBeDefined();
  });
});
