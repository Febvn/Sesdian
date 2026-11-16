// Startup file for hosts that expect a fixed entry point (Hostinger hPanel's
// Node.js app setup and Phusion Passenger default to "app.js"). The server
// itself lives in server.mjs; this only boots it in production mode.
import { startServer } from './server.mjs';

startServer({ dev: false });
