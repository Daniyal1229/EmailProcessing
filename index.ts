import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import authRoutes from './routes/authRoutes';
import gmailRoutes from './routes/gmailRoutes';
import outlookRoutes from './routes/outlookRoutes';

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(
	session({
		secret: 'any_secret_key',
		resave: false,
		saveUninitialized: false,
	})
);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/', authRoutes);
app.use('/gmail', gmailRoutes);
app.use('/outlook', outlookRoutes);

export const repeat = { pattern: '*/30 * * * * *' };

// Define the port to listen on
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
