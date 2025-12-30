require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const User = require('../models/User');

// Connect to DB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crateyy').then(() => {
    console.log('MongoDB Connected for Seeding');
    seedData();
}).catch(err => {
    console.error(err);
    process.exit(1);
});

const seedData = async () => {
    try {
        // Read JSON files
        const productsPath = path.join(__dirname, '../data/products.json');
        const usersPath = path.join(__dirname, '../data/users.json');

        const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        // Clear existing data (optional, be careful in prod)
        await Product.deleteMany({});
        await User.deleteMany({});

        // Insert new data
        await Product.insertMany(products);
        await User.insertMany(users);

        console.log('Data Imported Successfully!');
        process.exit();
    } catch (err) {
        console.error('Error importing data:', err);
        process.exit(1);
    }
};
