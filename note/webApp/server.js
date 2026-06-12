const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

const { connectToServer, getDb } = require('./db');

app.use(express.static(path.join(__dirname, 'public')));

// Route to get the index.html file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Boot sequence : connect to the database and start the server
connectToServer().then(() => {
    app.listen(PORT, () => {
        console.log("Server active on port"+PORT);
    });
});