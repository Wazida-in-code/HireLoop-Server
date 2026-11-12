import express from 'express'
import 'dotenv/config'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 8000
app.use(express.json());
app.use(cors());

import { MongoClient, ObjectId } from 'mongodb';
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

// get all jobs
app.get('/jobs', async(req, res) => {
  const query = {}
  console.log(req.query);
  if(req.query){
    if(req.query.jobType){
      query.jobType = req.query.jobType
    }
    if(req.query.isRemote){
      query.isRemote = req.query.isRemote === 'true'
    }
    if(req.query.category){
      query.category = req.query.category
    }
    if(req.query.search){
      query.$or = [
        {title: {$regex: req.query.search, $options: 'i'}},
        {description: {$regex: req.query.search, $options: 'i'}},
        {requirements: {$regex: req.query.search, $options: 'i'}},
        {company: {$regex: req.query.search, $options: 'i'}}
      ]
    }
  }
  const cursor = jobs.find(query);
  const result = await cursor.toArray();
  res.send(result)
})


// get job by id
app.get('/jobs/:id' , async (req, res) => {
    const {id} = req.params 
    const result = await jobs.findOne({_id: new ObjectId(id)})   
    res.send(result)
})



// delete job
app.delete('/jobs/:id', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const result = await jobs.deleteOne(query)
  res.json(result)
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