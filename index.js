import express from 'express'
import 'dotenv/config'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 8000
app.use(express.json());
app.use(cors());

import { MongoClient } from 'mongodb';
const client = new MongoClient(process.env.MONGO_DB_CLIENT_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectToDB = await connectToMongoDB()
const db = connectToDB.db("HireLoop")
const users = db.collection("user")
const jobs = db.collection("jobs")

// get job in database
app.post('/jobs', async(req, res) => {
    const data = req.body
    const result = await jobs.insertOne(data)
    res.send(result)
})



// get users
app.get('/users', async(req, res) => {
  const cursor = users.find({});
  const result = await cursor.toArray();
  res.send(result)
})

app.get('/', (req, res) => {
    res.send("Server Is Running Perfectly!")
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
})