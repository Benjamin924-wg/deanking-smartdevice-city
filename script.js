let cart = JSON.parse(localStorage.getItem("cart")) || [];

const defaultProducts = [
    { id: "phone-cases", name: "Phone cases", description: "Protect your phone with stylish and durable cases.", price: 3000, image: "images/Phone cases.jpg" },
    { id: "chargers", name: "Chargers", description: "Fast and reliable phone chargers for your devices.", price: 7000, image: "images/Charger.jpg" },
    { id: "power-banks", name: "Power Banks", description: "Keep your phone powered anywhere you go.", price: 45000, image: "images/Power bank.jpg" },
    { id: "earpieces", name: "Earpieces", description: "Enjoy clear sound and comfortable listening.", price: 5000, image: "images/Earpieses.jpg" }
];

let products = [];

async function loadProducts() {
    try {
        const response = await fetch("/api/products", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load products.");
        products = await response.json();
        renderProducts();
        renderManagedProducts();
    } catch (error) {
        console.error(error);
        const productGrid = document.getElementById("product-grid");
        if (productGrid) productGrid.innerHTML = "<p>Products are temporarily unavailable. Please try again.</p>";
    }
}

function renderProducts() {
    const productGrid = document.getElementById("product-grid");
    if (!productGrid) return;

    productGrid.innerHTML = "";
    products.forEach(function(product) {
        const card = document.createElement("article");
        card.className = "product";

        const image = document.createElement("img");
        image.src = product.image;
        image.alt = product.name;

        const name = document.createElement("h3");
        name.textContent = product.name;
        const description = document.createElement("p");
        description.textContent = product.description;
        const price = document.createElement("p");
        price.innerHTML = "<strong>₦" + Number(product.price).toLocaleString() + "</strong>";
        const quantityLabel = document.createElement("label");
        quantityLabel.textContent = "Quantity:";
        quantityLabel.htmlFor = "quantity-" + product.id;
        const quantity = document.createElement("input");
        quantity.type = "number";
        quantity.id = "quantity-" + product.id;
        quantity.value = "1";
        quantity.min = "1";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Add to Cart";
        button.onclick = function() {
            addToCart(product.name, product.price, product.image, quantity.value);
        };

        card.append(image, name, description, price, quantityLabel, quantity, button);
        productGrid.appendChild(card);
    });
}

function renderManagedProducts() {
    const list = document.getElementById("managed-product-list");
    if (!list) return;
    list.innerHTML = "";

    products.forEach(function(product) {
        const item = document.createElement("div");
        item.className = "managed-product";
        item.innerHTML = "<div><strong></strong><span></span></div><div class=\"managed-product-actions\"><button type=\"button\" class=\"edit-product\">Edit</button><button type=\"button\" class=\"delete-product secondary-button\">Delete</button></div>";
        item.querySelector("strong").textContent = product.name;
        item.querySelector("span").textContent = "₦" + Number(product.price).toLocaleString() + " — " + product.description;
        item.querySelector(".edit-product").onclick = function() { editProduct(product.id); };
        item.querySelector(".delete-product").onclick = function() { deleteProduct(product.id); };
        list.appendChild(item);
    });
}

function editProduct(id) {
    const product = products.find(function(item) { return item.id === id; });
    if (!product) return;
    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-description").value = product.description;
    document.getElementById("product-price").value = product.price;
    document.getElementById("product-image").value = product.image;
    document.getElementById("save-product-button").textContent = "Save Changes";
    document.getElementById("cancel-edit-button").hidden = false;
    document.getElementById("product-name").focus();
}

function resetProductForm() {
    document.getElementById("product-form").reset();
    document.getElementById("product-id").value = "";
    document.getElementById("save-product-button").textContent = "Add Product";
    document.getElementById("cancel-edit-button").hidden = true;
}

async function deleteProduct(id) {
    const product = products.find(function(item) { return item.id === id; });
    if (!product || !window.confirm("Delete " + product.name + "?")) return;
    const response = await fetch("/api/products/" + encodeURIComponent(id), { method: "DELETE" });
    if (!response.ok) {
        document.getElementById("product-form-status").textContent = "Unable to delete product.";
        return;
    }
    await loadProducts();
}

async function setupProductManager() {
    const loginSection = document.getElementById("owner-login-section");
    const managerPanel = document.getElementById("product-manager-panel");
    const loginForm = document.getElementById("owner-login-form");
    if (!loginForm || !loginSection || !managerPanel) return;

    const setAuthenticated = function(authenticated) {
        loginSection.hidden = authenticated;
        managerPanel.hidden = !authenticated;
    };

    const sessionResponse = await fetch("/api/owner/session", { cache: "no-store" });
    setAuthenticated((await sessionResponse.json()).authenticated);
    if (!managerPanel.hidden) await loadProducts();

    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const status = document.getElementById("owner-login-status");
        const response = await fetch("/api/owner/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: document.getElementById("owner-password").value })
        });
        if (!response.ok) {
            status.textContent = "Incorrect owner password.";
            return;
        }
        loginForm.reset();
        status.textContent = "";
        setAuthenticated(true);
        await loadProducts();
    });

    document.getElementById("owner-logout-button").onclick = async function() {
        await fetch("/api/owner/logout", { method: "POST" });
        setAuthenticated(false);
    };

    const form = document.getElementById("product-form");
    form.addEventListener("submit", function(event) {
        event.preventDefault();
        const id = document.getElementById("product-id").value;
        const product = {
            id: id || "product-" + Date.now(),
            name: document.getElementById("product-name").value.trim(),
            description: document.getElementById("product-description").value.trim(),
            price: Number(document.getElementById("product-price").value),
            image: document.getElementById("product-image").value.trim()
        };
        if (!product.name || !product.description || !product.image || product.price <= 0) return;
        const request = fetch(id ? "/api/products/" + encodeURIComponent(id) : "/api/products", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(product)
        });
        request.then(async function(response) {
            if (!response.ok) throw new Error("Unable to save product.");
            await loadProducts();
            resetProductForm();
            document.getElementById("product-form-status").textContent = "Product saved successfully.";
        }).catch(function(error) {
            document.getElementById("product-form-status").textContent = error.message;
        });
    });
    document.getElementById("cancel-edit-button").onclick = resetProductForm;
    renderManagedProducts();
}

function addToCart(productName, price, image, quantity) {

    quantity = Number(quantity) || 1;

    cart.push({
        name: productName,
        price: Number(price),
        image: image,
        quantity: quantity
    });

    localStorage.setItem("cart", JSON.stringify(cart));

    alert(productName + " has been added to your cart!");

    displayCart();
}


function displayCart() {

    const cartItems = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");

    if (!cartItems || !cartTotal) {
        return;
    }

    cartItems.innerHTML = "";
    if (cart.length === 0) {
        cartItems.innerHTML = "<p>Your cart is empty.</p>";
        cartTotal.textContent = "Total: ₦0";
        return;
    }

    let total = 0;

    cart.forEach(function(item, index) {

        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const subtotal = price * quantity;

        total += subtotal;

        const product = document.createElement("div");
        product.className = "cart-item";

        const image = document.createElement("img");
        image.src = item.image;
        image.alt = item.name;

        image.style.width = "80px";
        image.style.height = "80px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "10px";

        const name = document.createElement("h3");
        name.textContent = item.name;

        const priceText = document.createElement("p");
        priceText.textContent = "Price: ₦" + price.toLocaleString();

        const quantityText = document.createElement("p");
        quantityText.textContent = "Quantity: " + quantity;

        const subtotalText = document.createElement("p");
        subtotalText.textContent = "Subtotal: ₦" + subtotal.toLocaleString();

        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";

        removeButton.onclick = function() {
            removeItem(index);
        };

        product.appendChild(image);
        product.appendChild(name);
        product.appendChild(priceText);
        product.appendChild(quantityText);
        product.appendChild(subtotalText);
        product.appendChild(removeButton);

        cartItems.appendChild(product);
    });

    cartTotal.textContent = "Total: ₦" + total.toLocaleString();
}


function removeItem(index) {

    cart.splice(index, 1);

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();
}


function clearCart() {

    cart = [];

    localStorage.removeItem("cart");

    displayCart();

    alert("Your cart has been cleared!");
}


function checkout() {

    if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
    }

    const selectedPayment = document.querySelector(
        'input[name="paymentMethod"]:checked'
    );

    if (!selectedPayment) {
        alert("Please choose a payment method.");
        return;
    }

    const paymentMethod = selectedPayment.value;

    let message = "Hello DeanKing Smartdevice City!%0A%0A";
    message += "I want to place an order.%0A%0A";

    let total = 0;

    cart.forEach(function(item) {

        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const subtotal = price * quantity;

        message += "- " + encodeURIComponent(item.name);
        message += " × " + quantity;
        message += " — ₦" + subtotal.toLocaleString();
        message += "%0A";

        total += subtotal;
    });

    message += "%0ATotal: ₦" + total.toLocaleString();
    message += "%0APayment Method: " + encodeURIComponent(paymentMethod);
    message += "%0A%0APlease let me know the next step.";

    const phoneNumber = "2349163044892";
    const whatsappURL = "https://wa.me/" + phoneNumber + "?text=" + message;

    window.location.href = whatsappURL;
}


displayCart();
setupProductManager();
loadProducts();
function sendProductRequest() {

    const name = document.getElementById("customerName").value;
    const email = document.getElementById("customerEmail").value;
    const product = document.getElementById("productNeeded").value;
    const details = document.getElementById("requestDetails").value;

    if (name === "" || email === "" || product === "") {
        alert("Please fill in your name, email and product needed.");
        return;
    }

    const message =
        "Hello DeanKing Smartdevice City!%0A%0A" +
        "I want to request a product.%0A%0A" +
        "Name: " + encodeURIComponent(name) + "%0A" +
        "Email: " + encodeURIComponent(email) + "%0A" +
        "Product needed: " + encodeURIComponent(product) + "%0A" +
        "Details: " + encodeURIComponent(details);

    const phoneNumber = "2349163044892";

    const whatsappURL =
        "https://wa.me/" + phoneNumber + "?text=" + message;

    window.location.href = whatsappURL;
}