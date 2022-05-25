const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

// verify Jsonwebtoken
function verifyJWToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send({ message: 'Unathorized Access' });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            res.status(403).send({ message: 'Forbidden' });
        }
        else {
            req.decoded = decoded;
            next();
        }
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cars-parts.ncua4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const partsCollencton = client.db('carParts').collection('parts');
        const orderCollencton = client.db('carParts').collection('orders');
        const paymentCollection = client.db('carParts').collection('payment');
        const reviewCollencton = client.db('carParts').collection('reviews');

        // authentication
        app.post('/createjwt', (req, res) => {
            const email = req.body;
            const accessJWT = jwt.sign(email, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1d' });
            res.send({ accessJWT });
        })

        // Payment
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        // Parts
        app.get('/parts', async (req, res) => {
            const parts = await partsCollencton.find().toArray();
            res.send(parts)
        });

        app.get('/singleparts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const singleparts = await partsCollencton.findOne(query);
            res.send(singleparts)
        });

        app.post('/parts', async (req, res) => {
            const parts = req.body;
            const result = await partsCollencton.insertOne(parts);
            res.send(result);
        })

        // orders
        app.get('/orders', async (req, res) => {
            const orders = (await orderCollencton.find().toArray()).reverse();
            res.send(orders);
        });
        app.get('/orders/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const orders = (await orderCollencton.find(query).toArray()).reverse();
            res.send(orders);
        });

        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollencton.findOne(query);
            res.send(order);
        })

        app.post('/order', async (req, res) => {
            const data = req.body;
            const result = await orderCollencton.insertOne(data);
            res.send(result);
        });


        // Review
        app.get('/review', async (req, res) => {
            const reviews = (await reviewCollencton.find().toArray()).reverse();
            res.send(reviews);
        });

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