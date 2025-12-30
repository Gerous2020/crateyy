const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true }, // Keeping numeric ID for frontend compatibility
    name: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    category: { type: String, required: true }, // e.g., 'new-drops'
    type: { type: String, required: true }, // e.g., 't-shirt'
    image: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
