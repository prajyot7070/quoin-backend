"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const trinoRoutes_1 = __importDefault(require("./routes/trinoRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const PORT = process.env.PORT || 3004;
const app = (0, express_1.default)();
//added localhost origin
const corsOptions = {
    origin: ['https://quoin-frontend.vercel.app', 'http://localhost:3000'],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    //hellooo
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
// Trino Routes
app.use('/api/trino', trinoRoutes_1.default);
// AI Routes
app.use('/api/ai', aiRoutes_1.default);
app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}!`);
});
