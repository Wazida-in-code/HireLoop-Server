import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import Stripe from 'stripe'

const app = express()
const PORT = process.env.PORT || 8000
app.use(express.json());
app.use(cors());

const myLogger = (req, res, next) => {
  console.log(req.url, req.headers);
  next()
}

// verify token
const verifyToken = async(req, res, next) => {
  // find header
  const authHeader = req.headers.authorization;
  if(!authHeader){
    res.status(401).send({message: 'unauthorized'});
    return;
  }
  // find token from header
  const token = authHeader.split(' ')[1]
  if(!token){
    res.status(401).send({message: 'unauthorized'});
    return;
  }
  // find session from token
  const query = {token};
  const session = await sessions.findOne(query);
  if(!session){
    res.status(401).send({message: 'unauthorized'});
    return;
  }
  // find user from session
  const userId = session.userId;

  const userQuery = {_id: new ObjectId(userId)};
  const user = await users.findOne(userQuery);
  if(!user){
    res.status(401).send({message: 'unauthorized'});
    return;
  }

  req.user = user;
  next();
}


// verify seeker
const verifySeeker = async(req, res, next) => {
  if(req.user.role !== 'seeker'){
    res.status(403).send({message: 'Forbidden'});
    return;
  }
  next();
}

// verify recruiter
const verifyRecruiter = async(req, res, next) => {
  if(req.user.role !== 'recruiter'){
    res.status(403).send({message: 'Forbidden'});
    return;
  }
  next();
}


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
const sessions = db.collection("session")
const jobs = db.collection("jobs")
const applications = db.collection("applications")
const payments = db.collection("payments")

// get job in database
app.post('/jobs', verifyToken, verifyRecruiter, async(req, res) => {
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
    if(req.query.recruiterId){
      query.recruiterId = req.query.recruiterId
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
app.post('/applications', verifyToken, verifySeeker, async(req, res) => {
  const application = req.body
  const result = await applications.insertOne(application)
  res.send(result);
})


// update application's status
app.patch('/applications/:id', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const updatedDoc = {
    $set: {
      status: req.body.status,
    }
  }
  const result = await applications.updateOne(query, updatedDoc)
  res.send(result)
})


// all application
app.get('/applications', verifyToken , async(req, res) => {
  const query = {}
  if(req.query.userId){
    query.userId = req.query.userId
  }
  console.log(req.query);
  if(req.query.jobId){

    const jobQuery = {_id: new ObjectId(req.query.jobId)};
    const job = await jobs.findOne(jobQuery);
    if(job.recruiterId !== req.user._id.toString() && req.user.role !== 'admin'){
      res.status(403).send({message: 'Forbidden'});  //http://localhost:3000/dashboard/recruiter/jobs/6af8a333bf4e41425f396db6/applications
      return;
    }

    query.jobId = req.query.jobId
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


app.get('/users/:id/premium', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const result = await users.findOne(query, {projection: {premium: 1}})
  res.send(result)
})


// update user role
app.patch('/users/:id/role', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const updatedDoc = {
    $set: {
      userRole: req.body.role,
      role: req.body.role === "admin" ? "admin" : "user"
    }
  }
  const result = await users.updateOne(query, updatedDoc)
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