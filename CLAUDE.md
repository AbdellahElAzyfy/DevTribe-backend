# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevTribe is a community platform backend API built with Node.js, Express, MongoDB, and Socket.io. It provides authentication, community management, posts, comments, and real-time notifications.

## Development Commands

```bash
# Development with auto-reload
npm run dev

# Production start
npm start

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `MONGODB_URI` - MongoDB connection string
- `CLIENT_ORIGIN` - Frontend URL for CORS
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` - JWT signing secrets
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Cloudinary credentials for file uploads
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)

## Architecture

The codebase follows a layered architecture pattern:

**Routes** (`src/routes/`) → **Controllers** (`src/controllers/`) → **Services** (`src/services/`) → **Models** (`src/models/`)

### Request Flow

1. **Routes** define endpoints and attach middleware (validation, authentication)
2. **Middleware** (`src/middleware/`) handles cross-cutting concerns:
   - `authenticate.js` - JWT token verification and session validation
   - `authorizeRoles.js` - Role-based access control
   - `validateRequest.js` - Zod schema validation (attaches validated data to `req.validated`)
   - `uploadFile.js` - Multer + Cloudinary file upload
   - `rateLimiter.js` - Rate limiting
   - `errorHandler.js` - Centralized error handling
3. **Controllers** handle HTTP request/response, call services, manage cookies
4. **Services** contain business logic, interact with models
5. **Models** define Mongoose schemas and database interactions

### Key Patterns

- **Validation**: Zod schemas in `src/validators/` validate request data. The `validateRequest` middleware attaches validated data to `req.validated.body` or `req.validated.params`.
- **Authentication**: JWT-based with access tokens (short-lived, in Authorization header) and refresh tokens (long-lived, in httpOnly cookies). Session tracking via `RefreshToken` model with JTI (JWT ID).
- **Authorization**: `authenticate` middleware populates `req.user` with `{id, username, email, role}`. Use `authorizeRoles(...roles)` middleware to restrict endpoints.
- **Error Handling**: Services throw errors with `error.statusCode` property. The `errorHandler` middleware catches and formats them.
- **File Uploads**: Multer middleware uploads to Cloudinary. File metadata available in `req.file`. Use `deleteCloudinaryFile()` helper for cleanup on errors.

## Core Models

- **User** - username, email, password (bcrypt hashed), avatar, bio, role (user/moderator/admin), isActive, lastLoginAt
- **RefreshToken** - Tracks active sessions with JTI, user reference, expiration, revocation
- **Community** - name, description, creator, members, moderators
- **Post** - title, content, author, community, images, votes
- **Comment** - content, author, post, parent (for nested comments), votes
- **Vote** - user, target (post/comment), voteType (upvote/downvote)
- **SavedPost** - user, post (for bookmarking)

## Authentication System

The authentication system uses a dual-token approach:

1. **Access Token**: Short-lived JWT (typically 15-30 minutes) sent in `Authorization: Bearer <token>` header. Contains user ID (`sub`), session ID (`sid`), and role.
2. **Refresh Token**: Long-lived JWT (7 days) stored in httpOnly cookie. Used to obtain new access tokens.
3. **Session Tracking**: Each login creates a `RefreshToken` document with a unique JTI. Access tokens reference this JTI via `sid` claim.
4. **Session Validation**: The `authenticate` middleware verifies both the access token signature AND checks that the session (JTI) exists and hasn't been revoked.
5. **Token Rotation**: Refreshing tokens revokes the old refresh token and creates a new token pair with a new JTI.

## Real-time Features

Socket.io server is initialized in `server.js` and configured in `src/sockets/`:
- `index.js` - Socket.io server setup with CORS
- `socketEmitter.js` - Provides `getSocketServer()` to emit events from anywhere in the app
- Socket authentication middleware in `src/middleware/socket/authenticateSocket.js`

Emit events using:
```javascript
const { getSocketServer } = require('./sockets/socketEmitter');
const io = getSocketServer();
io.to(userId).emit('notification', data);
```

## File Upload Strategy

Files are uploaded to Cloudinary via Multer:
- Avatar uploads: `uploadAvatar` middleware (single file, 'avatar' field)
- Post images: `uploadPostImage` middleware (single file, 'image' field)
- Uploaded file path available in `req.file.path` (Cloudinary URL)
- Uploaded file public_id available in `req.file.filename`
- On error, clean up with `deleteCloudinaryFile(req.file.filename)`

## Testing

Tests are in `tests/` directory using Jest and Supertest:
- `health.test.js` - Health check endpoint tests
- `middleware.test.js` - Middleware unit tests

When writing tests:
- Use `supertest` for HTTP endpoint testing
- Mock external services (Cloudinary, database) when appropriate
- Run tests with `npm test` (runs in band to avoid database conflicts)

## API Structure

All routes are prefixed with `/api/v1`:
- `/api/v1/health` - Health check
- `/api/v1/auth` - Authentication (register, login, refresh, logout, me, profile updates)
- `/api/v1/communities` - Community CRUD and membership
- `/api/v1/posts` - Post CRUD, voting, saving
- `/api/v1/comments` - Comment CRUD, voting, nested comments
- `/api/v1/notifications` - User notifications

## Adding New Features

When adding a new feature:

1. **Model** - Define Mongoose schema in `src/models/`
2. **Validator** - Create Zod schemas in `src/validators/`
3. **Service** - Implement business logic in `src/services/`
4. **Controller** - Handle HTTP in `src/controllers/`
5. **Routes** - Define endpoints in `src/routes/`, attach middleware
6. **Register Routes** - Import and mount in `src/app.js`

Follow the existing pattern: look at `auth.routes.js`, `auth.controller.js`, `auth.service.js`, and `auth.validators.js` as reference implementations.

## Common Gotchas

- **Password Selection**: User password field has `select: false`. Use `.select('+password')` when you need it (login, password change).
- **Validation**: Always access validated data from `req.validated.body` or `req.validated.params`, not directly from `req.body` or `req.params`.
- **Session Validation**: The `authenticate` middleware checks both token validity AND active session. Logging out revokes the refresh token, which invalidates all access tokens for that session.
- **Cookie Path**: Auth cookies are scoped to `/api/v1/auth` path. Ensure cookie operations use the same path from `getCookieOptions()`.
- **Error Status Codes**: Set `error.statusCode` on thrown errors. The error handler uses this for HTTP status codes.
- **Cloudinary Cleanup**: Always clean up uploaded files if subsequent operations fail (see `updateProfile` controller for example).
