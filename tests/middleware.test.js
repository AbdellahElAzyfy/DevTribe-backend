const { z } = require("zod");
const validateRequest = require("../src/middleware/validateRequest");
const authorizeRoles = require("../src/middleware/auth/authorizeRoles");

describe("validateRequest", () => {
  it("passes validated data to req.validated", () => {
    const schema = z.object({
      body: z.object({
        title: z.string().min(3),
      }),
    });

    const req = { body: { title: "Hello" }, params: {}, query: {}, headers: {} };
    const res = {};
    const next = jest.fn();

    validateRequest(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.validated.body.title).toBe("Hello");
  });

  it("returns a validation error when the body is invalid", () => {
    const schema = z.object({
      body: z.object({
        title: z.string().min(3),
      }),
    });

    const req = { body: { title: "Hi" }, params: {}, query: {}, headers: {} };
    const res = {};
    const next = jest.fn();

    validateRequest(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toHaveProperty("statusCode", 400);
  });
});

describe("authorizeRoles", () => {
  it("allows matching roles to continue", () => {
    const req = { user: { role: "admin" } };
    const res = {};
    const next = jest.fn();

    authorizeRoles("admin", "moderator")(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("blocks non-allowed roles", () => {
    const req = { user: { role: "user" } };
    const res = {};
    const next = jest.fn();

    authorizeRoles("admin")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toHaveProperty("statusCode", 403);
  });
});
