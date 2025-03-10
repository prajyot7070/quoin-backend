import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';

dotenv.config();

const PORT = process.env.PORT || 3003;
const app = express();

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json("Hello");
});

// Auth routes
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}!`);
});
