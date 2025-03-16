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
const corsOptions = {
  origin: ['https://quoin-frontend.vercel.app','http://localhost:3000'],
  credentials: true,
};

app.use(cors(corsOptions));


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
