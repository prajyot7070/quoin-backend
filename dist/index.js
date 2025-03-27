"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const cors_1 = __importDefault(require("cors"));
const organizationRoutes_1 = __importDefault(require("./routes/organizationRoutes"));
const projectRoutes_1 = __importDefault(require("./routes/projectRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const queryRoutes_1 = __importDefault(require("./routes/queryRoutes"));
dotenv_1.default.config();
const PORT = process.env.PORT || 3004;
const app = (0, express_1.default)();
//added localhost origin
const corsOptions = {
    origin: ['https://quoin-frontend.vercel.app', 'http://localhost:3000'],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
};
//added options
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
// Middleware
app.use(express_1.default.json());
// Routes
app.get('/', (req, res) => {
    res.json("Hello");
});
// Auth routes
app.use('/api/auth', authRoutes_1.default);
// Organization routes
app.use('/api/organizations', organizationRoutes_1.default);
// Project routes
app.use('/api/projects', projectRoutes_1.default);
// AI routes
app.use('/api/ai', aiRoutes_1.default);
// Query routes
app.use('/api/queries', queryRoutes_1.default);
app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}!`);
});
