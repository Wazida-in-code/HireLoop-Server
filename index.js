import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import Stripe from 'stripe'

const app = express()
const PORT = process.env.PORT || 8000
app.use(express.json());
app.use(cors());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
const applications = db.collection("applications")
const payments = db.collection("payments")

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

// insert apply now btn's user's info
app.post('/applications', async(req, res) => {
  const application = req.body
  const result = await applications.insertOne(application)
  res.send(result);
})

// all application
app.get('/applications', async(req, res) => {
  const query = {}
  if(req.query.userId){
    query.userId = req.query.userId
  }
  const cursor = applications.find(query);
  const result = await cursor.toArray();
  res.send(result)
})

// how many application are there
app.get('/applications/count', async(req, res) => {
  const query = {}
  if(req.query.userId){
    query.userId = req.query.userId
  }
  const result = await applications.countDocuments(query)
  res.send({count : result})
})


// payment verification
app.post('/payments/checkout-verify', async(req, res) =>{
  const {sessionId} = req.body
  if(!sessionId){
    return res.send({success: false, msg: "Session Id is required"})
  }
  const {status,
    payment_status,
    customer_email, 
    metadata,
    payment_intent} = await stripe.checkout.sessions.retrieve(sessionId);

    // 1. is used new session 
    // 2. check is the session id for the currently logged in user
    // 3. insert sessionId into the payment Collection
    // 4. update user information as premium user

    if (status === 'complete' && payment_status=='paid'){

      const sessionQuery = {sessionId}
      const existingPayment = await payments.findOne(sessionQuery)
      if(existingPayment){
        return res.send({success: false, msg: "Payment already exist"})
      }

      const payment = {
        sessionId,
        status,
        payment_status,
        customer_email, 
        userId: metadata.userId,
        payment_date: new Date(),
        payment_intent
      }
      const result = await payments.insertOne(payment)

      // update the user 
      const query = {_id: new ObjectId(metadata.userId)}
      const updatedInfo = {
        $set : {
          premium: true
        }
      }
      const updateResult = await users.updateOne(
        query,
        updatedInfo
      )
      res.send({success: true, result, updateResult})
      return
    }

    res.send({success: false , msg: "Payment failed!"})
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