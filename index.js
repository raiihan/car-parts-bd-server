const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cars-parts.ncua4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const partsCollencton = client.db('carParts').collection('parts');
        const reviewCollencton = client.db('carParts').collection('reviews');

        app.get('/parts', async (req, res) => {
            const parts = await partsCollencton.find().toArray();
            res.send(parts)
        })


        // Review

        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollencton.insertOne(review);
            res.send(result)
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