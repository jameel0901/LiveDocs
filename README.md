# LiveDocs

A simplified Google Docs-like application with real-time collaboration.

Documents are saved with a name and content. When exiting the editor, the latest
text and chosen name are persisted to MongoDB.

## Backend Environment Variables
Create a `.env` file inside the `Back-end` directory (the server always loads it from this location) and supply the following variables:

```
PORT=5000
ATLAS_URI=<your MongoDB connection string>
CORS_ORIGIN=https://jameel0901.github.io
```

`PORT` sets the HTTP/WebSocket server port and defaults to `5000` if not specified.
`ATLAS_URI` is required for connecting to your MongoDB database.
`CORS_ORIGIN` sets the allowed origins for HTTP and WebSocket requests. Multiple
origins can be separated with commas.

## Running the Application

Use the root `dev` script to start both the backend and frontend:

```bash
npm run dev
```

Ensure MongoDB is accessible using the connection string you provide in the `.env` file.

## Frontend Configuration

The React client can be pointed to a custom API and WebSocket server by setting the following environment variables when running `npm start` or building the docs:

```
REACT_APP_API_URL=<backend http base URL>
REACT_APP_SOCKET_URL=<backend websocket URL>
```

If not provided, both default to `https://livedocs-gool.onrender.com`.
