import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import trinoRoutes from './routes/trinoRoutes';
import aiRoutes from './routes/aiRoutes';
import cors from 'cors';

dotenv.config();

const PORT = process.env.PORT || 3004;
const app = express();

//added localhost origin
// const corsOptions = {
//   origin: ['https://quoin-frontend.vercel.app','http://localhost:3000'],
//   credentials: true,
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
//   allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],


// };
// //added options
// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions));
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: string | boolean) => void) => {
    const allowedOrigins = ['https://quoin-frontend.vercel.app', 'http://localhost:3000'];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); 
    } else {
      callback(new Error('Not allowed by CORS')); 
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json("Hello");
});

// Auth routes
app.use('/api/auth', authRoutes);

// Trino Routes
app.use('/api/trino', trinoRoutes);

// AI Routes
app.use('/api/ai', aiRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}!`);
});
