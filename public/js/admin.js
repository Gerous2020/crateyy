document.addEventListener('DOMContentLoaded', () => {
    // Session Check
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') {
        alert('Access Denied. Admins only.');
        window.location.href = 'login.html';
        return;
    }

    const tableBody = document.getElementById('admin-products-body');
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const addBtn = document.getElementById('add-product-btn');
    const closeBtn = document.getElementById('close-modal');

    let isEditing = false;

    // Fetch and Render Products
    const fetchProducts = async () => {
        try {
            const response = await fetch('/api/products');
            const products = await response.json();
            renderTable(products);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const renderTable = (products) => {
        tableBody.innerHTML = products.map(product => `
            <tr>
                <td><img src="${product.image}" alt="" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td>${product.name}</td>
                <td>₹${product.price}</td>
                <td>${product.category}</td>
                <td>${product.type}</td>
                <td>${product.discount > 0 ? `<span class="discount-badge">-${product.discount}%</span>` : '0%'}</td>
                <td>
                    <button class="btn btn-outline" style="padding: 5px 15px; font-size: 0.8rem;" onclick="editProduct(${product.id})">Edit</button>
                    <button class="btn btn-outline" style="padding: 5px 15px; font-size: 0.8rem; border-color: red; color: red;" onclick="deleteProduct(${product.id})">Del</button>
                </td>
            </tr>
        `).join('');
    };

    // Open Modal
    addBtn.addEventListener('click', () => {
        isEditing = false;
        document.getElementById('modal-title').innerText = 'Add New Drop';
        form.reset();
        modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Handle Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('name', document.getElementById('p-name').value);
        formData.append('price', document.getElementById('p-price').value);
        formData.append('discount', document.getElementById('p-discount').value);
        formData.append('category', document.getElementById('p-category').value);
        formData.append('type', document.getElementById('p-type').value);

        const fileInput = document.getElementById('p-image-file');
        if (fileInput.files[0]) {
            formData.append('image', fileInput.files[0]);
        } else {
            // If no new file, send existing image path IF we are editing
            formData.append('existingImage', document.getElementById('p-existing-image').value);
        }

        try {
            if (isEditing) {
                const id = document.getElementById('product-id').value;
                await fetch(`/api/products/${id}`, {
                    method: 'PUT',
                    body: formData // No Content-Type header needed for FormData
                });
            } else {
                await fetch('/api/products', {
                    method: 'POST',
                    body: formData
                });
            }
            modal.classList.remove('active');
            fetchProducts();
        } catch (error) {
            console.error('Error saving:', error);
        }
    });

    // Edit Product (Global function for onclick)
    window.editProduct = async (id) => {
        const response = await fetch('/api/products');
        const products = await response.json();
        const product = products.find(p => p.id === id);

        if (product) {
            isEditing = true;
            document.getElementById('modal-title').innerText = 'Edit Product';
            document.getElementById('product-id').value = product.id;
            document.getElementById('p-name').value = product.name;
            document.getElementById('p-price').value = product.price; // assuming simple value provided
            document.getElementById('p-discount').value = product.discount || 0;
            document.getElementById('p-category').value = product.category;
            document.getElementById('p-type').value = product.type;

            // Set existing image hidden field
            document.getElementById('p-existing-image').value = product.image;
            // Clear file input
            document.getElementById('p-image-file').value = '';

            modal.classList.add('active');
        }
    };

    // Delete Product
    window.deleteProduct = async (id) => {
        if (confirm('Are you sure you want to delete this drop?')) {
            await fetch(`/api/products/${id}`, { method: 'DELETE' });
            fetchProducts();
        }
    };

    fetchProducts();
});
