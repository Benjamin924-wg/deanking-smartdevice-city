let cart = JSON.parse(localStorage.getItem("cart")) || [];

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


function showPaymentStatus() {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const reference = params.get("reference");

    if (paymentStatus === "success" && reference) {
        alert("Payment successful! Reference: " + reference + "\nYour order has been confirmed.");
        clearCart();
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function startPaystackCheckout() {
    const checkoutStatus = document.getElementById("checkout-status");
    const showCheckoutError = function(message) {
        if (checkoutStatus) {
            checkoutStatus.textContent = message;
            checkoutStatus.style.color = "#b42318";
        }
        alert(message);
    };

    if (window.location.protocol === "file:") {
        showCheckoutError("Card payment needs the website server. Open http://localhost:3000 or use Bank Transfer instead.");
        return;
    }

    const emailInput = document.getElementById("checkoutEmail");
    const nameInput = document.getElementById("checkoutName");
    const email = emailInput ? emailInput.value.trim() : "";
    const customerName = nameInput ? nameInput.value.trim() : "";

    if (!email || !email.includes("@")) {
        if (emailInput) emailInput.focus();
        showCheckoutError("A valid email is required to continue with payment.");
        return;
    }

    if (!customerName) {
        if (nameInput) nameInput.focus();
        showCheckoutError("Your name is required to continue with payment.");
        return;
    }

    let total = 0;
    cart.forEach(function(item) {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        total += price * quantity;
    });

    fetch("/api/create-payment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: email,
            name: customerName,
            amount: total,
            metadata: {
                cart: cart.map(function(item) {
                    return item.name + " x" + (Number(item.quantity) || 1);
                })
            }
        })
    })
    .then(function(response) {
        if (!response.ok) {
            return response.json().then(function(errorData) {
                throw new Error(errorData.error || "Unable to start payment.");
            });
        }
        return response.json();
    })
    .then(function(data) {
        if (!data.authorization_url) {
            throw new Error(data.error || "Unable to start payment.");
        }

        window.location.href = data.authorization_url;
    })
    .catch(function(error) {
        showCheckoutError(error.message || "Payment could not be started. Please try again. You can also choose Bank Transfer instead.");
    });
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

    if (paymentMethod === "Card") {
        startPaystackCheckout();
        return;
    }

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


showPaymentStatus();
displayCart();
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