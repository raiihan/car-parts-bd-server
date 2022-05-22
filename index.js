const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cars-parts.ncua4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const partsCollencton = client.db('carParts').collection('parts');

        app.get('/parts', async (req, res) => {
            const parts = await partsCollencton.find().toArray();
            res.send(parts)
        })

    } finally { }
}
run();

app.get('/', (req, res) => {
    res.send('Welcome Car Parts BD');
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})