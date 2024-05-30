const express = require('express')
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5555;


// middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://apis-client.web.app', 'https://apis-client.firebaseapp.com'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


// Database conection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.y7qgnfe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
//console.log(uri);


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


//middlewares
const logger = async (req, res, next) => {
  console.log('called: ', req.host, req.originalUrl)
  next();
}

const verifyToken = async(req, res, next) => {
  const token = req?.cookies?.token;
  console.log('value of token in middleware', token)
  if(!token){
    return res.status(401).send({message: 'not authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if(err){
      console.log(err);
      return res.status(401).send({message: 'unauthorized'})
    }
    // if valid, then decoded
    console.log('value in the token', decoded);
    req.user = decoded;
    next();
  })
  
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // create database

    const userCollection = client.db("apisDb").collection('user');
    const queryCollection = client.db("apisDb").collection('query');
    const recommenCollection = client.db("apisDb").collection('recommendation');


    // =============== auth related api ======================

    app.post('/jwt', logger, async(req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      //console.log(token)
      // res.send(user)
      //res.send(token)
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: true,
        //sameSite: 'none'
      })
      .send({success: true})
    })

    app.post('/logout', async(req, res) => {
      const user = req.body;
      console.log('logging out', user);
      res.clearCookie('token', {maxAge: 0}).send({success: true})
    })

    // =============== API for recommendation ======================
    // create
    app.post('/recommendation', async(req, res) => {
      const query = req.body;
      const result = await recommenCollection.insertOne(query);
      res.send(result);
    })
    // get all recommendation
    app.get('/recommendation', async(req, res) => {
      const result = await recommenCollection.find().toArray();
      res.send(result);
    })
    
    // get specific recommendation
    app.get('/recommendcomment/:id', async(req, res) => {
      const id = req.params.id;
      const query = {queryId: id};
      const result = await recommenCollection.find(query).sort({ createdAt: -1 }).toArray();
      //console.log(result);
      res.send(result)
    })

    // get recommendation by email wise
    app.get('/myrecommendation/:email', async(req, res) => {
      const email = req.params.email;
      const query = {recommenderEmail: email};
      const result = await recommenCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result)
    })

    // delete recommendation
    app.delete('/recommendation/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await recommenCollection.deleteOne(query);
      res.send(result)
    })

    // recommendation for me
    app.get('/recomforme/:email', async(req, res) => {
      const email = req.params.email;
      //console.log(email)
      const query = {userEmail: email};
      const result = await recommenCollection.find(query).toArray();
      res.send(result)
    })
//'userEmail' is not defined.
    
    // =============== API for query ======================
    // create
    app.post('/query', async(req, res) => {
      const query = req.body;
      console.log(query);
      const result = await queryCollection.insertOne(query);
      res.send(result);
    })
    // get all query
    app.get('/query', async(req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      console.log('pagination query', page, size);
      //const result = await queryCollection.find().toArray();
      const result = await queryCollection.find()
      .sort({ createdAt: -1 })
      .skip(page * size)
      .limit(size)
      .toArray();
      res.send(result);
    })

    app.get('/queryCount', async (req, res) => {
      const count = await queryCollection.estimatedDocumentCount();
      res.send({ count });
    })
    // get single query
    app.get('/query/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await queryCollection.findOne(query);
      res.send(result)
    })
    
    // get single user query
    app.get('/myquery/:email', async(req, res) => {
      const email = req.params.email;
      const query = {authorEmail: email};
      //console.log('email query', query);
      const result = await queryCollection.find(query).sort({ createdAt: -1 }).toArray();
      //console.log(result);
      res.send(result)
    })

    //edit or update
    app.put('/query/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const options = {upsert: true};
      const updatedQueryDetails = req.body;
      const newQuery = {
        $set: {
          productName: updatedQueryDetails.productName,
          brandName: updatedQueryDetails.brandName,
          image: updatedQueryDetails.image,
          queryTitle: updatedQueryDetails.queryTitle,
          boycotReason: updatedQueryDetails.boycotReason
        }
      }
      const result = await queryCollection.updateOne(filter, newQuery, options);
      res.send(result)
    })

    // delete query
    app.delete('/query/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await queryCollection.deleteOne(query);
      res.send(result)
    })
      
    // =============== API for User ======================

    //create
    app.post('/user', async(req, res) => {
      const user = req.body;
      console.log(user);
      const result = await userCollection.insertOne(user);
      res.send(result);
    })
    //get all users
    app.get('/user', logger, verifyToken, async(req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    // get single user
    app.get('/user/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.findOne(query);
      res.send(result)
    })
    // patch or update user last logged in
    app.patch('/user', async(req, res) => {
      const user = req.body;
      const filter = {email: user.email};
      const updateUser = {
        $set: {
          lastLoggedAt: user.lastLoggedAt, 
        }

      }
      const result = await userCollection.updateOne(filter, updateUser);
      res.send(result)
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Website is running')
})

app.listen(port, () => {
  console.log(`apis is running on port ${port}`)
})