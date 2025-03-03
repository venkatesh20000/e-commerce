const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const app = express();
const PORT = 3030;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Ensure database file exists
if (!fs.existsSync('./ecommerce.db')) {
    fs.writeFileSync('./ecommerce.db', '');
}

// Database Setup
const db = new sqlite3.Database('./ecommerce.db', (err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }
    console.log('Connected to SQLite database');
});

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT);");
    db.run("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL, discount REAL, specifications TEXT, image TEXT);");
    db.run("CREATE TABLE IF NOT EXISTS cart (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product_id INTEGER);");

    // Insert products into the database
    const products = [];
    for (let i = 1; i <= 25; i++) {
        products.push([, (i * 10), (i % 5), , ]);
    }
    products.forEach(product => {
        db.run("INSERT INTO products (name, price, discount, specifications, image) VALUES (?, ?, ?, ?, ?)", product);
    });
});

// Redirect to login if not authenticated
app.use((req, res, next) => {
    if (!req.session.user && !['/login', '/register'].includes(req.path)) {
        return res.redirect('/login');
    }
    next();
});

// Routes
app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));
app.get('/cart', (req, res) => {
    db.all("SELECT products.* FROM cart INNER JOIN products ON cart.product_id = products.id WHERE cart.user_id = ?", [req.session.user?.id], (err, items) => {
        if (err) return res.status(500).send("Database error");
        res.render('cart', { items });
    });
});
app.get('/buy', (req, res) => res.render('buy'));
app.get('/payment', (req, res) => res.render('payment'));

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).send("Error hashing password");
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], (err) => {
            if (err) return res.status(400).send("Username already exists");
            res.redirect('/login');
        });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user) return res.status(400).send("User not found");
        bcrypt.compare(password, user.password, (err, match) => {
            if (!match) return res.status(400).send("Incorrect password");
            req.session.user = user;
            res.redirect('/');
        });
    });
});

app.get('/', (req, res) => {
    db.all("SELECT * FROM products", [], (err, products) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.render('home', { products });
    });
});

app.post('/add-to-cart', (req, res) => {
    const { product_id } = req.body;
    if (!req.session.user) return res.redirect('/login');
    db.run("INSERT INTO cart (user_id, product_id) VALUES (?, ?)", [req.session.user.id, product_id], (err) => {
        if (err) return res.status(500).send("Database error");
        res.redirect('/cart');
    });
});

app.listen(PORT, () => {
    console.log();
});
