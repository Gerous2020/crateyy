const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); // File Uploads
const Razorpay = require('razorpay'); // Razorpay
const cors = require('cors');
require('dotenv').config(); // Load Env

const mongoose = require('mongoose');
const Product = require('./models/Product');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crateyy')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Auth Packages
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

app.use(cors());
// Middleware for parsing JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Config (Required for Passport)
app.use(session({
    secret: 'crateyy_secret_key', // Change this in prod
    resave: false,
    saveUninitialized: false
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Config
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                return done(null, user);
            }

            // If not, check by email
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
                // Link Google ID to existing email account
                user.googleId = profile.id;
                await user.save();
                return done(null, user);
            }

            // Create new user
            user = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                role: 'customer' // Default role
            });
            await user.save();
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));

// Serialize/Deserialize User for Session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Configure Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
// Also serve via /public to match physical path (for Live Server compatibility)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// --- AUTHENTICATION ROUTES ---

// --- AUTHENTICATION ROUTES ---

// API: Google Auth Route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// API: Google Auth Callback
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/public/login.html' }),
    (req, res) => {
        // Successful authentication
        // Redirect to a page that will handle storing the session/token if needed
        // For simple session flow, just redirect to home
        res.redirect('/index.html');
    }
);

// API: Check Session (For frontend to know if logged in)
app.get('/api/current_user', (req, res) => {
    res.json(req.user || null);
});

// API: Logout
app.get('/api/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// API: Login
app.post('/api/login', async (req, res) => {
    const { email, password, role } = req.body;

    try {
        const user = await User.findOne({ email, password }); // Find user

        if (user) {
            // Role Check
            if (role && user.role !== role) {
                return res.status(403).json({ message: 'Unauthorized role access' });
            }
            res.json({ success: true, user: { name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// API: Register
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const newUser = new User({
            name,
            email,
            password, // In prod, hash this!
            role: role || 'customer'
        });

        await newUser.save();

        res.status(201).json({ success: true, user: { name: newUser.name, email: newUser.email, role: newUser.role } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- RAZORPAY PAYMENT ---
app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body; // Amount in INR
    try {
        const options = {
            amount: Math.round(amount * 100), // Convert to paise (Integer)
            currency: "INR",
            receipt: "receipt_" + Date.now(),
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ success: false, message: 'Payment initiation failed' });
    }
});

// API: Get Key ID (To send to frontend)
app.get('/api/razorpay-key', (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID });
});

// --- PRODUCT ROUTES ---

// --- PRODUCT ROUTES ---

// API: Get All Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// API: Add Product
app.post('/api/products', upload.single('image'), async (req, res) => {
    let imagePath = req.file ? `public/uploads/${req.file.filename}` : req.body.existingImage;
    if (!imagePath) imagePath = 'https://via.placeholder.com/300?text=No+Image';

    const newProduct = new Product({
        id: Date.now(), // Keeping custom ID logic for now
        name: req.body.name,
        price: req.body.price,
        discount: req.body.discount,
        category: req.body.category,
        type: req.body.type,
        image: imagePath
    });

    try {
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(400).json({ message: 'Error saving product' });
    }
});

// API: Update Product
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    const id = parseInt(req.params.id);

    try {
        const product = await Product.findOne({ id: id });
        if (product) {
            let imagePath = product.image;
            if (req.file) {
                imagePath = `public/uploads/${req.file.filename}`;
            } else if (req.body.existingImage) {
                imagePath = req.body.existingImage;
            }

            product.name = req.body.name || product.name;
            product.price = req.body.price || product.price;
            product.discount = req.body.discount || product.discount;
            product.category = req.body.category || product.category;
            product.type = req.body.type || product.type;
            product.image = imagePath;

            await product.save();
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error updating product' });
    }
});

// API: Delete Product
app.delete('/api/products/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await Product.deleteOne({ id: id });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting product' });
    }
});

// Fallback
// Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
