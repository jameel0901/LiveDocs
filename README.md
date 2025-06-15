# LiveDocs

A simplified Google Docs-like application with real-time collaboration.

Documents are saved with a name and content. When exiting the editor, the latest
text and chosen name are persisted to MongoDB.

## Backend Environment Variables
Create a `.env` file inside the `Back-end` directory (the server always loads it from this location) and supply the following variables:

```
PORT=5000
ATLAS_URI=<your MongoDB connection string>
```

`PORT` sets the HTTP/WebSocket server port and defaults to `5000` if not specified.
`ATLAS_URI` is required for connecting to your MongoDB database.

## Running the Application

Use the root `dev` script to start both the backend and frontend:

```bash
npm run dev
```

Ensure MongoDB is accessible using the connection string you provide in the `.env` file.
