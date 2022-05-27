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
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
        if (err) {
            res.status(403).send({ message: 'Forbidden Access' });
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

        const partsCollection = client.db('carParts').collection('parts');
        const userCollection = client.db('carParts').collection('users');
        const orderCollection = client.db('carParts').collection('orders');
        const reviewCollection = client.db('carParts').collection('reviews');
        const paymentCollection = client.db('carParts').collection('payments');

        // payment 
        app.post('/create-payment-intent', verifyJWToken, async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = parseInt(price) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        })

        // authentication
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const accessJWT = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1d' });
            res.send({ result, accessJWT });
        });

        app.get('/users', verifyJWToken, async (req, res) => {
            const users = (await userCollection.find().toArray()).reverse();
            res.send(users);
        })

        app.get('/user', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        });
        app.get('/user/:id', verifyJWToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const user = await userCollection.findOne(query);
            res.send(user);
        });

        app.patch('/user/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: data.name,
                    education: data.education,
                    linkedin: data.linkedin,
                    phone: data.phone,
                    location: data.location
                }
            }
            const updateuser = await userCollection.updateOne(filter, updatedDoc);
            res.send(updateuser);
        });
        // Make admin
        app.put('/user/admin/:email', verifyJWToken, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                }
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

        });

        app.get('/admin/:email', verifyJWToken, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })



        // Parts
        app.get('/parts', async (req, res) => {
            const parts = (await partsCollection.find().toArray()).reverse();
            res.send(parts)
        });

        app.get('/singleparts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const singleparts = await partsCollection.findOne(query);
            res.send(singleparts)
        });

        app.post('/parts', async (req, res) => {
            const parts = req.body;
            const result = await partsCollection.insertOne(parts);
            res.send(result);
        });

        app.delete('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await partsCollection.deleteOne(filter);
            res.send(result);
        })

        // orders
        app.get('/orders', verifyJWToken, async (req, res) => {
            const orders = (await orderCollection.find().toArray()).reverse();
            res.send(orders);
        });
        app.get('/orders/:email', verifyJWToken, async (req, res) => {
            const email = req.params.email;
            const jwtEmail = req.decoded.email;
            if (email === jwtEmail) {
                const query = { email: email };
                const orders = (await orderCollection.find(query).toArray()).reverse();
                res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        });

        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })

        app.post('/order', async (req, res) => {
            const data = req.body;
            const result = await orderCollection.insertOne(data);
            res.send(result);
        });

        app.patch('/order/:id', verifyJWToken, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                    status: 'pending'
                }
            };
            const result = await paymentCollection.insertOne(payment);
            const paymentOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        });

        app.patch('/orderstatus/:id', verifyJWToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: { status: 'shipped' }
            };
            const orderStatus = await orderCollection.updateOne(filter, updatedDoc);
            res.send(orderStatus);
        })

        app.delete('/order/:id', verifyJWToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        })

        // Review
        app.get('/review', async (req, res) => {
            const reviews = (await reviewCollection.find().toArray()).reverse();
            res.send(reviews);
        });

        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
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