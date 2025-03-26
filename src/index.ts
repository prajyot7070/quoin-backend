import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import cors from 'cors';
import organizationRoutes from './routes/organizationRoutes';
import projectRoutes from './routes/projectRoutes';
import aiRoutes from './routes/aiRoutes';
import queryRoutes from './routes/queryRoutes';

dotenv.config();

const PORT = process.env.PORT || 3004;
const app = express();

//added localhost origin
 const corsOptions = {
   origin: ['https://quoin-frontend.vercel.app','http://localhost:3000'],
   credentials: true,
   methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
   allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],


 };
 //added options
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

// Organization routes
app.use('/api/organizations', organizationRoutes);

// Project routes
app.use('/api/projects', projectRoutes);

// AI routes
app.use('/api/ai', aiRoutes);

// Query routes
app.use('/api/queries', queryRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}!`);
});
