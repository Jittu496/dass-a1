const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
    res.send('Test Server Works!');
});

app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});