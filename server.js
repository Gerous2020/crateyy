const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); // File Uploads
const Razorpay = require('razorpay'); // Razorpay
const cors = require('cors');
require('dotenv').config(); // Load Env

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Middleware for parsing JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Data File Paths
const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Helper: Read Data (Generic)
const readJson = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper: Write Data (Generic)
const writeJson = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
};

// --- AUTHENTICATION ROUTES ---

// API: Login
app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;
    const users = readJson(USERS_FILE);

    // Find user matching email, password, and (optional) role
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // If role is specified, verify it matches
        if (role && user.role !== role) {
            return res.status(403).json({ message: 'Unauthorized role access' });
        }
        // Return user info (excluding password)
        const { password, ...userWithoutPass } = user;
        res.json({ success: true, user: userWithoutPass });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// API: Register
app.post('/api/register', (req, res) => {
    const { name, email, password, role } = req.body;
    const users = readJson(USERS_FILE);

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password,
        role: role || 'customer' // Default to customer
    };

    users.push(newUser);
    writeJson(USERS_FILE, users);

    const { password: _, ...userWithoutPass } = newUser;
    res.status(201).json({ success: true, user: userWithoutPass });
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

// API: Get All Products
app.get('/api/products', (req, res) => {
    const products = readJson(DATA_FILE);
    res.json(products);
});

// API: Add Product
app.post('/api/products', upload.single('image'), (req, res) => {
    const products = readJson(DATA_FILE);

    let imagePath = req.file ? `public/uploads/${req.file.filename}` : req.body.existingImage;
    if (!imagePath) imagePath = 'https://via.placeholder.com/300?text=No+Image'; // Fallback

    const newProduct = {
        id: Date.now(),
        name: req.body.name,
        price: req.body.price,
        discount: req.body.discount,
        category: req.body.category,
        type: req.body.type,
        image: imagePath
    };

    products.push(newProduct);
    writeJson(DATA_FILE, products);
    res.status(201).json(newProduct);
});

// API: Update Product
app.put('/api/products/:id', upload.single('image'), (req, res) => {
    const products = readJson(DATA_FILE);
    const id = parseInt(req.params.id);
    const index = products.findIndex(p => p.id === id);

    if (index !== -1) {
        // Prepare updated fields
        let imagePath = products[index].image; // Keep old image by default
        if (req.file) {
            imagePath = `public/uploads/${req.file.filename}`;
        } else if (req.body.existingImage) {
            imagePath = req.body.existingImage;
        }

        const updatedProduct = {
            ...products[index],
            name: req.body.name || products[index].name,
            price: req.body.price || products[index].price,
            discount: req.body.discount || products[index].discount,
            category: req.body.category || products[index].category,
            type: req.body.type || products[index].type,
            image: imagePath
        };

        products[index] = updatedProduct;
        writeJson(DATA_FILE, products);
        res.json(updatedProduct);
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
});

// API: Delete Product
app.delete('/api/products/:id', (req, res) => {
    let products = readJson(DATA_FILE);
    const id = parseInt(req.params.id);
    products = products.filter(p => p.id !== id);
    writeJson(DATA_FILE, products);
    res.json({ message: 'Deleted successfully' });
});

// Fallback
// Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
